// IMPORTS
// ================================================================================================
import { Client, QueryResult } from 'pg';

import { Query, SingleResultQuery, ListResultQuery, toPgQuery, PgQuery } from './Query';
import { Collector } from './Collector';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './errors';
import { defaults } from './defaults';
import { since, Logger } from './util';

// INTERFACES AND ENUMS
// ================================================================================================
export interface SessionOptions {
    readonly?   : boolean;
}

const enum SessionState {
    pending = 1, active, closing, closed
}

// SESSION CLASS DEFINITION
// ================================================================================================
export class Session {

    dbName      : string;
    private client  : Client;
    private readonly: boolean;
    private state   : SessionState;
    private batch   : PgQuery[];
    private logger? : Logger;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(dbName: string, client: Client, options: SessionOptions, logger?: Logger) {
        if (!client) throw new ConnectionError('Cannot create a connection session: client is undefined');
        this.dbName = dbName;
        
        this.client = client;
        this.readonly = !!options.readonly;
        this.state = SessionState.pending;
        this.batch = [];
        this.logger = logger;
    }

    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isActive(): boolean {
        return (this.state <= SessionState.active);
    }

    get inTransaction(): boolean {
        return (this.state === SessionState.active);
    }

    get isReadOnly(): boolean {
        return this.readonly;
    }

    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    close(action?: 'commit' | 'rollback'): Promise<any> {
        if (!this.isActive) {
            return Promise.reject(
                new ConnectionError('Cannot close session: session has already been closed'));
        }
        
        switch (action) {
            case 'rollback': {
                return this.rollbackAndRelease();
            }
            default: {
                this.logger && this.logger.debug('Closing the session', this.dbName);
                if (this.inTransaction) {
                    const commitPromise = this.execute(COMMIT_TRANSACTION).then(() => this.releaseClient());
                    this.state = SessionState.closing;
                    return commitPromise;
                }
                else {
                    return Promise.resolve(this.releaseClient());
                }
            }
        }
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    execute<T>(query: SingleResultQuery<T>): Promise<T>
    execute<T>(query: ListResultQuery<T>): Promise<T[]>
    execute(query: Query<void>): Promise<void>
    execute<T>(query: Query<T>): Promise<T> {
        if (this.isActive === false) {
            return Promise.reject(
                new ConnectionError('Cannot execute a query: the session is closed'));
        }

        const pgQuery = toPgQuery(query);
        if (this.state === SessionState.pending) {
            const beginQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
            // TODO: append this to the beginning of the query batch
        }

        const resultPromise: Promise<any> = new Promise(function(resolve, reject) {
            // TODO: refactro to handle multiple sources
            pgQuery.source = [{
                query   : query,
                resolve : resolve,
                reject  : reject
            }];
        });

        this.batch.push(pgQuery);

        process.nextTick(() => {
            const start = process.hrtime();

            const batch = this.batch;
            this.batch = [];

            this.logger && this.logger.debug(`Executing ${batch.length} queries: [...]`, this.dbName);
            for (let query of batch) {
                this.client.query(query, (error, results) => {
                    if (error) {
                        // TODO: release the client on error
                        for (let source of query.source) source.reject(error);
                        return;
                    }

                    for (let source of query.source) {
                        const rows = this.processQueryResult(source.query, results);
                        if (source.query.mask === 'list') {
                            source.resolve(rows);
                        }
                        else if (source.query.mask === 'single') {
                            source.resolve(rows[0]);
                        }
                        else {
                            source.resolve(undefined);
                        }
                    }

                    // TODO: log only the last query in the batch
                    this.logger && this.logger.trace(this.dbName, 'query', since(start), true);
                });
            }
        });

        return resultPromise;
    }

    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    protected processQueryResult(query: any, result: QueryResult): any[] {
        let processedResult: any[];
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
        this.logger && this.logger.debug('Rolling back transaction and closing the session', this.dbName);
        const rollbackPromise = new Promise((resolve, reject) => {
            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
                    error = new QueryError(error);
                    this.releaseClient(error);
                    reason ? reject(reason) : reject(error);
                }
                else {
                    if (reason) {
                        this.releaseClient();
                        reject(reason);
                    }
                    else {
                        this.releaseClient();
                        resolve();
                    }
                }
            });
        });

        this.state = SessionState.closing;
        return rollbackPromise;
    }
    
    protected releaseClient(error?: any) {
        this.state = SessionState.closed;
        if (this.client) {
            this.client.release(error);
            this.client = undefined;
            this.logger && this.logger.debug('Session closed', this.dbName);
        }
        else {
            this.logger && this.logger.warn('Overlapping client release detected', this.dbName);
        }
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private executeQuery(query: PgQuery): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.query(query, (error, results) => {
                console.log(query.text);
                error ? reject(new QueryError(error)) : resolve(results);
            });
        });
    }
}

// COMMON QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION: Query<void> = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ ONLY;'
};

const BEGIN_RW_TRANSACTION: Query<void> = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ WRITE;'
};

const COMMIT_TRANSACTION: Query<void> = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};

const ROLLBACK_TRANSACTION: Query<void> = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};