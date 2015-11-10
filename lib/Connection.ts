// IMPORTS
// ================================================================================================
import * as assert from 'assert';
import * as pg from 'pg';

import { logger } from './../index';
import { Query, ResultQuery, isResultQuery, isParametrized, toDbQuery, DbQuery } from './Query';
import { Collector } from './Collector';
import { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './errors'

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
    private client      : pg.Client;
    private done        : (error?: Error) => void;

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
            return Promise.reject(
                new ConnectionError('Cannot start transaction: connection is not currently active'));
        
        if (this.inTransaction)
            return Promise.reject(
                new TransactionError('Cannot start transaction: connection is already in transaction'));
        
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
            return Promise.reject(
                new ConnectionError('Cannot release connection: connection has already been released'));
        
        switch (action) {
            case 'commit':
                return this.execute(COMMIT_TRANSACTION)
                    .then(() => this.releaseConnection());
            case 'rollback':
                return this.rollbackAndRelease();
            default:
                if (this.inTransaction) {
                    return this.rollbackAndRelease(
                        new TransactionError('Uncommitted transaction detected during connection release'));
                }
                else {
                    this.releaseConnection();
                    return Promise.resolve();
                }
        }
    }

    // EXECUTE METHOD
    // --------------------------------------------------------------------------------------------
    execute<T>(query: ResultQuery<T>): Promise<any>
    execute(query: Query): Promise<any>
    execute(queries: Query[]): Promise<Map<string,any>>
    execute(queryOrQueries: Query | Query[]): Promise<any> {
        if (this.isActive === false)
            return Promise.reject(
                new ConnectionError('Cannot execute queries: connection has been released'));

        var { queries, state } = this.buildQueryList(queryOrQueries);
        
        return Promise.resolve()
            .then(() => this.buildDbQueries(queries))
            .then((dbQueries) => dbQueries.map((query) => this.executeQuery(query)))
            .then((queryResults) => Promise.all(queryResults))
            .then((results) => {
                try {
                    var flatResults = results.reduce((agg: any[], result) => agg.concat(result), []);
                    if (queries.length !== flatResults.length)
                        throw new ParseError(`Cannot parse query results: expected (${queries.length}) results but recieved (${results.length})`);
                    
                    var collector = new Collector(queries);
                    queries.forEach((query, i) => {
                        collector.addResult(query, this.processQueryResult(query, flatResults[i]));
                    });
                    this.state = state;
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
            for (var i = 0; i < result.rows.length; i++) {
                processedResult.push(query.handler.parse(result.rows[i]));
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
                error ? reject(new QueryError(error)) : resolve(results);
            });
        });
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