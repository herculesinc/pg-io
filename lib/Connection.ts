// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import * as pg from 'pg';

import { Query, ResultQuery, isResultQuery, isParametrized, toDbQuery, DbQuery } from './Query';
import Collector from './Collector';
import { PgError } from './errors'

// INTERFACES AND ENUMS
// ================================================================================================
export interface Options {
    collapseQueries?    : boolean;
    startTransaction?   : boolean;
}

enum State {
    connection = 1,
    transaction,
    transactionPending,
    released
}

// CONNECTION CLASS DEFINITION
// ================================================================================================
export class Connection {

    private options : Options;
    private client  : pg.Client;
    private done    : (error?: Error) => void;
    private state   : State;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(options: Options, client: pg.Client, done: (error?: Error) => void) {
        this.options = options;
        this.client = client;
        this.done = done;
        if (options.startTransaction) {
            this.state = State.transactionPending;
        }
        else{
            this.state = State.connection;
        }
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
        if (this.isActive === false)
            return Promise.reject(new PgError('Cannot start transaction: connection is not currently active'));
        
        if (this.inTransaction)
            return Promise.reject(new PgError('Cannot start transaction: connection is already in transaction'));
        
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

    release(action?: string): Promise<any> {
        if (this.state === State.released)
            return Promise.reject(new PgError('Cannot release connection: connection has already been released'));
        
        return Promise.resolve().then(() => {
            if (action === 'commit') {
                return this.execute(COMMIT_TRANSACTION).catch((reason) => {
                    return this.rollbackTransaction(reason);
                })
            }
            else if (action === 'rollback') {
                return this.rollbackTransaction();
            }
            else if (this.inTransaction) {
                return this.rollbackTransaction(new PgError('Uncommitted transaction detected during connection release'));
            }
        }).then(() => this.releaseConnection());
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    execute<T>(query: ResultQuery<T>): Promise<any>
    execute(query: Query): Promise<any>
    execute(queries: Query[]): Promise<Map<string,any>>
    execute(queryOrQueries: Query | Query[]): Promise<any> {
        if (this.isActive === false)
            return Promise.reject(new PgError('Cannot execute queries: connection has been released'));

        var { queries, state } = this.buildQueryList(queryOrQueries);
        
        return Promise.resolve()
            .then(() => this.buildDbQueries(queries))
            .then((dbQueries) => dbQueries.map((query) => this.executeQuery(query)))
            .then((queryResults) => Promise.all(queryResults))
            .then((results) => {
                var flatResults = results.reduce((agg: any[], result) => agg.concat(result), []);
                if (queries.length !== flatResults.length)
                    throw new PgError(`Cannot process query results: expected (${queries.length}) results but recieved (${results.length})`);
                
                var collector = new Collector(queries);
                queries.forEach((query, i) => {
                    var result = flatResults[i];
                    var processedResult: any = this.processQueryResult(query, result);
                    collector.addResult(query, processedResult);
                });
                this.state = state;
                return collector.getResults();    
            })
            .catch((reason) => {
                if (reason instanceof PgError === false){
                    reason = new PgError(reason.message);
                }
                return this.rollbackTransaction(reason);
            });
    }

    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    protected processQueryResult(query: any, result: pg.QueryResult): any[] {
        
        var processedResult: any[];
        if (query.handler && typeof query.handler.parse === 'function') {
            processedResult = [];
            for (var i = 0; i < result.rows.length; i++) {
                processedResult.push(query.handler.parse(result.rows[i]));
            }
        }
        else {
            processedResult = result.rows;
        }
        return processedResult;
    }

    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    private buildQueryList(queryOrQueries: Query | Query[]) {
        if (Array.isArray(queryOrQueries)) {
            var queries = <Query[]> queryOrQueries;
        }
        else {
            var queries = <Query[]> (queryOrQueries? [queryOrQueries] : []);
        }

        var state = this.state;
        if (this.state === State.transactionPending && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            state = State.transaction;
        }

        return { queries, state };
    }
    
    private buildDbQueries(queries: Query[]): DbQuery[] {
        var dbQueries: DbQuery[] = [];
        var previousQuery: DbQuery;
    
        for (var i = 0; i < queries.length; i++) {
            var dbQuery = toDbQuery(queries[i]);
            
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
                error ? reject(error) : resolve(results);
            });
        });
    }

    private rollbackTransaction(reason?: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
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
                        resolve();
                    }
                }
            });
        });
    }
    
    private releaseConnection(error?: any) {
        this.state = State.released;
        this.done(error);
    }
}

// COMMON QUERIES
// ================================================================================================
var BEGIN_TRANSACTION: Query = {
    text: 'BEGIN;'
};

var COMMIT_TRANSACTION: Query = {
    text: 'COMMIT;'
};

var ROLLBACK_TRANSACTION: Query = {
    text: 'ROLLBACK;'
};