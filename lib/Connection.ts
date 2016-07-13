// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import * as pg from 'pg';

import { Database, config, Logger } from './../index';
import { Query, SingleResultQuery, ListResultQuery, isResultQuery, isParametrized, toDbQuery, DbQuery } from './Query';
import { Collector } from './Collector';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './errors'
import { since } from './util';

// INTERFACES AND ENUMS
// ================================================================================================
export interface Options {
    collapseQueries?    : boolean;
    startTransaction?   : boolean;
}

const enum State {
    connection = 1,
    transaction,
    transactionPending,
    released
}

// CONNECTION CLASS DEFINITION
// ================================================================================================
export class Connection {

    protected state     : State;
    protected options   : Options;
    protected database  : Database;
    protected logger    : Logger;
    private client      : pg.Client;
    private done        : (error?: Error) => void;

    // CONSTRUCTOR AND INJECTOR
    // --------------------------------------------------------------------------------------------
    constructor(database: Database, options: Options) {
        this.database = database;
        this.options = options;
        this.logger = config.logger;
        if (options.startTransaction) {
            this.logger && this.logger.debug(`Starting database transaction in lazy mode`)
            this.state = State.transactionPending;
        }
        else{
            this.state = State.connection;
        }
    }
    
    inject(client: pg.Client, done: (error?: Error) => void) {
        this.client = client;
        this.done = done;
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get inTransaction(): boolean {
        return (this.state === State.transaction || this.state === State.transactionPending);
    }

    get isActive(): boolean {
        return (this.state !== State.released);
    }

    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    startTransaction(lazy = true): Promise<void> {
        if (this.isActive === false) {
            return Promise.reject(
                new ConnectionError('Cannot start transaction: connection is not currently active'));
        }
        
        if (this.inTransaction) {
            return Promise.reject(
                new TransactionError('Cannot start transaction: connection is already in transaction'));
        }
        
        this.logger && this.logger.debug(`Starting database transaction in ${lazy ? 'lazy' : 'eager'} mode`);
        if (lazy) {
            this.state = State.transactionPending;
            return Promise.resolve();
        }
        else {
            return this.execute(BEGIN_TRANSACTION).then(() => {
                this.state = State.transaction;
            });
        }
    }

    release(action?: 'commit' | 'rollback'): Promise<any> {
        if (this.state === State.released) {
            return Promise.reject(
                new ConnectionError('Cannot release connection: connection has already been released'));
        }
        
        const start = process.hrtime();
        switch (action) {
            case 'commit':
                this.logger && this.logger.debug('Committing transaction and releasing connection back to the pool');
                return this.execute(COMMIT_TRANSACTION)
                    .then(() => { 
                        this.releaseConnection();
                        const duration = since(start);
                        this.logger && this.logger.debug(`Transaction committed in ${duration} ms; pool state: ${this.database.getPoolDescription()}`);
                        this.logger && this.logger.track(`${this.database.name}::commit`, duration);
                    });
            case 'rollback':
                this.logger && this.logger.debug('Rolling back transaction and releasing connection back to the pool');
                return this.rollbackAndRelease()
                    .then((result) => {
                        const duration = since(start);
                        this.logger && this.logger.debug(`Transaction rolled back in ${duration} ms; pool state: ${this.database.getPoolDescription()}`);
                        this.logger && this.logger.track(`${this.database.name}::rollback`, duration);
                        return result;
                    });
            default:
                this.logger && this.logger.debug('Releasing connection back to the pool');
                if (this.inTransaction) {
                    return this.rollbackAndRelease(
                        new TransactionError('Uncommitted transaction detected during connection release'));
                }
                else {
                    this.releaseConnection();
                    const duration = since(start);
                    this.logger && this.logger.debug(`Connection released in ${duration} ms; pool state: ${this.database.getPoolDescription()}`);
                    this.logger && this.logger.track(`${this.database.name}::release`, duration);
                    return Promise.resolve();
                }
        }
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    execute<T>(query: SingleResultQuery<T>): Promise<T>
    execute<T>(query: ListResultQuery<T>): Promise<T[]>
    execute(query: Query): Promise<any>
    execute(queries: Query[]): Promise<Map<string, any>>
    execute(queryOrQueries: Query | Query[]): Promise<any> {
        if (this.isActive === false) {
            return Promise.reject(
                new ConnectionError('Cannot execute queries: connection has been released'));
        }

        var start = process.hrtime();
        const { queries, command, state } = this.buildQueryList(queryOrQueries);
        this.logger && this.logger.debug(`Executing ${queries.length} queries: [${command}]`);
        
        return Promise.resolve()
            .then(() => this.buildDbQueries(queries))
            .then((dbQueries) => dbQueries.map((query) => this.executeQuery(query)))
            .then((queryResults) => Promise.all(queryResults))
            .then((results) => {
                try {
                    let duration = since(start);
                    this.logger && this.logger.debug(`Queries executed in ${duration} ms; processing results`);
                    this.logger && this.logger.trace(this.database.name, command, duration);
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

                    this.state = state;
                    duration = since(start);
                    this.logger && this.logger.debug(`Query results processed in ${duration} ms`);
                    return collector.getResults();
                }
                catch (error) {
                    if (error instanceof PgError === false)
                        error = new ParseError(error);
                    throw error;
                }    
            })
            .catch((reason) => {
                return this.rollbackAndRelease(reason);
            });
    }

    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    protected processQueryResult(query: any, result: pg.QueryResult): any[] {
        
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
        return new Promise((resolve, reject) => {
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
                        this.state = State.connection;
                        this.releaseConnection();
                        resolve();
                    }
                }
            });
        });
    }
    
    protected releaseConnection(error?: any) {
        this.state = State.released;
        this.done(error);
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private buildQueryList(queryOrQueries: Query | Query[]): { queries: Query[], command: string, state: State } {
        let queries = queryOrQueries 
            ? (Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])
            : [];

        // if transaction is pending
        let state = this.state;
        if (this.state === State.transactionPending && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            state = State.transaction;
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

        return { queries, command, state };
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