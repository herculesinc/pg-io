// IMPORTS
// ================================================================================================
import { Client, QueryResult } from 'pg';

import {
    Query, ResultQuery, SingleResultQuery, ListResultQuery, isParametrized, toDbQuery, DbQuery
} from './Query';
import { Collector } from './Collector';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './errors';
import { defaults } from './defaults';
import { DbLogger } from './util';

// INTERFACES AND ENUMS
// ================================================================================================
export interface SessionOptions {
    startTransaction?   : boolean;
    collapseQueries?    : boolean;
    logQueryText?       : boolean;
    timeout?            : number;
}

const enum TransactionState {
    pending = 1, active
}

// SESSION CLASS DEFINITION
// ================================================================================================
export class Session {

    client      : Client;
    options     : SessionOptions;
    transaction : TransactionState;
    closing     : boolean;
    logger      : DbLogger;
    clientError?: Error;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(client: Client, options: SessionOptions, logger: DbLogger) {
        if (!client) throw new ConnectionError('Cannot create a connection session: client is undefined');
        this.client = client;
        this.options = options;
        this.logger = logger;
        this.closing = false;
        this.clientError = null;

        if (this.options.startTransaction) {
            this.logger.debug(`Starting database transaction in lazy mode`);
            this.transaction = TransactionState.pending;
        }

        this.client.once('error', (error) => {
            this.clientError = error;
        });
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get inTransaction(): boolean {
        return (this.transaction > 0);
    }

    get isActive(): boolean {
        return (this.client !== undefined && this.closing === false);
    }

    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    startTransaction(lazy = true): Promise<void> {
        if (this.isActive === false) {
            return Promise.reject(
                new ConnectionError('Cannot start transaction: session is not currently active'));
        }

        if (this.inTransaction) {
            return Promise.reject(
                new TransactionError('Cannot start transaction: session is already in transaction'));
        }

        this.logger.debug(`Starting database transaction in ${lazy ? 'lazy' : 'eager'} mode`,);
        if (lazy) {
            this.transaction = TransactionState.pending;
            return Promise.resolve();
        }
        else {
            return this.execute(BEGIN_TRANSACTION).then(() => {
                this.transaction = TransactionState.active;
            });
        }
    }

    close(action?: 'commit' | 'rollback'): Promise<any> {
        if (!this.isActive) {
            return Promise.reject(
                new ConnectionError('Cannot close session: session has already been closed'));
        }

        switch (action) {
            case 'commit':
                this.logger.debug('Committing transaction and closing the session');
                const commitPromise = this.execute(COMMIT_TRANSACTION).then(() => this.releaseConnection());
                this.closing = true;
                return commitPromise;
            case 'rollback':
                return this.rollbackAndRelease();
            default:
                this.logger.debug('Closing the session');
                if (this.inTransaction) {
                    return this.rollbackAndRelease(
                        new TransactionError('Uncommitted transaction detected while closing the session'));
                }
                else {
                    return Promise.resolve(this.releaseConnection());
                }
        }
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    execute<T>(query: SingleResultQuery<T>): Promise<T>
    execute<T>(query: ListResultQuery<T>): Promise<T[]>
    execute<T>(query: ResultQuery<T>): Promise<any>
    execute(query: Query): Promise<any>
    execute(queries: Query[]): Promise<Map<string, any>>
    execute(queryOrQueries: Query | Query[]): Promise<any> {
        if (this.isActive === false) {
            return Promise.reject(
                new ConnectionError('Cannot execute queries: the session is closed'));
        }

        var start = process.hrtime();
        const { queries, command, transaction } = this.buildQueryList(queryOrQueries);
        if (!queries.length) return Promise.resolve();

        if (this.options.logQueryText) {
            const queryText = buildQueryText(queries);
            this.logger.debug(`Executing ${queries.length} queries:\n${queryText}`);
        }
        else {
            this.logger.debug(`Executing ${queries.length} queries: [${command}]`);
        }

        return Promise.resolve()
            .then(() => this.buildDbQueries(queries))
            .then((dbQueries) => dbQueries.map((query) => this.executeQuery(query)))
            .then((queryResults) => Promise.all(queryResults))
            .then((results) => {
                try {
                    this.logger.trace(command, start, true);
                    start = process.hrtime();

                    const flatResults = results.reduce((agg: any[], result) => agg.concat(result), []);
                    if (queries.length !== flatResults.length) {
                        throw new ParseError(`Cannot parse query results: expected (${queries.length}) results but recieved (${results.length})`);
                    }

                    const collector = new Collector(queries);
                    for (let i = 0; i < queries.length; i++) {
                        let query = queries[i];
                        collector.addResult(query, this.processQueryResult(query, flatResults[i]));
                    }

                    this.transaction = transaction;
                    this.logger.debug(`Query results processed in ${start} ms`);
                    return collector.getResults();
                }
                catch (error) {
                    if (error instanceof PgError === false)
                        error = new ParseError(error);
                    throw error;
                }
            })
            .catch((reason) => {
                this.logger.trace(command, start, false);
                return this.rollbackAndRelease(reason);
            });
    }

    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    protected processQueryResult(query: any, result: QueryResult): any[] {

        var processedResult: any[];
        if (query.handler && typeof query.handler.parse === 'function') {
            processedResult = [];
            for (let row of result.rows) {
                processedResult.push(query.handler.parse(row));
            }
        }
        else {
            processedResult = result.rows;
        }
        return processedResult;
    }

    protected rollbackAndRelease(reason?: any): Promise<any> {
        this.logger.debug('Rolling back transaction and closing the session');

        const rollbackPromise = new Promise((resolve, reject) => {
            if (this.clientError) {
                this.releaseConnection();
                reject(reason);
                this.clientError = null;
                return;
            }

            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
                    error = new QueryError(error);
                    this.releaseConnection(error);
                    reason ? reject(reason) : reject(error);
                }
                else {
                    if (reason) {
                        this.releaseConnection();
                        reject(reason);
                    }
                    else {
                        this.releaseConnection();
                        resolve();
                    }
                }
            });
        });

        this.closing = true;
        return rollbackPromise;
    }

    protected releaseConnection(error?: any) {
        this.transaction = undefined;
        if (this.client) {
            this.client.release(error);
            this.client = undefined;
            this.logger.debug('Session closed');
        }
        else {
            this.logger.warn('Overlapping connection release detected');
        }
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private buildQueryList(queryOrQueries: Query | Query[]): { queries: Query[], command: string, transaction: TransactionState } {
        let queries = queryOrQueries
            ? (Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])
            : [];

        // if transaction is pending
        let transaction = this.transaction;
        if (transaction === TransactionState.pending && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            transaction = TransactionState.active;
        }

        if (queries.length === 2 && queries[0] === BEGIN_TRANSACTION) {
            if (queries[1] === COMMIT_TRANSACTION || queries[1] === ROLLBACK_TRANSACTION) {
                queries = [];
            }
        }

        let qNames: string[] = [];
        for (let query of queries) {
            qNames.push(query.name ? query.name : 'unnamed');
        }
        const command = qNames.join(', ');

        return { queries, command, transaction };
    }

    private buildDbQueries(queries: Query[]): DbQuery[] {
        const dbQueries: DbQuery[] = [];
        var previousQuery: DbQuery;

        for (let query of queries) {
            let dbQuery = toDbQuery(query);

            if (this.options.collapseQueries && previousQuery && !isParametrized(dbQuery) && !isParametrized(previousQuery)) {
                previousQuery.text += dbQuery.text;
                previousQuery.multiResult = true;
            }
            else {
                dbQueries.push(dbQuery);
                previousQuery = dbQuery;
            }
        }

        return dbQueries;
    }

    private executeQuery(query: DbQuery): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.query(query, (error, results) => {
                error ? reject(new QueryError(error)) : resolve(results);
            });
        });
    }
}

// COMMON QUERIES
// ================================================================================================
const BEGIN_TRANSACTION: Query = {
    name: 'qBeginTransaction',
    text: 'BEGIN;'
};

const COMMIT_TRANSACTION: Query = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};

const ROLLBACK_TRANSACTION: Query = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};

// HELPER FUNCTIONS
// ================================================================================================
function buildQueryText(queries: Query[]): string {
    if (!queries || !queries.length) return undefined;
    let text = '';

    for (let query of queries) {
        let queryName = query.name ? query.name : 'unnamed';
        let sideLength = Math.floor((78 - queryName.length) / 2);
        text += ('_'.repeat(sideLength) + '[' + queryName + ']' + '_'.repeat(sideLength)) + '\n';
        text += (query.text + '\n');
    }

    text += ('_'.repeat(80));
    return text;
}
