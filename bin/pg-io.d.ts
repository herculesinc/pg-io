declare module "pg-io" {

    // IMPORTS
    // --------------------------------------------------------------------------------------------
    import * as events from 'events';

    // GLOBAL
    // --------------------------------------------------------------------------------------------
    export interface DatabaseOptions {
        name?           : string;
        pool?           : PoolOptions;
        connection      : ConnectionSettings;
    }

    export interface ConnectionSettings {
        host            : string;
        port?           : number;
        user            : string;
        password        : string;
        database        : string;
    }
    
    export interface PoolOptions {
        maxSize?        : number;
        idleTimeout?    : number;
        reapInterval?   : number;
    }

    export const defaults: {
        name            : string;
        SessionCtr      : typeof Session;
        connection      : ConnectionSettings;
        session         : SessionOptions;
        pool            : PoolOptions;
    };

    export const util: {
        since(start: number[]): number;
    };

    // DATABASE
    // --------------------------------------------------------------------------------------------
    export interface SessionOptions {
        collapseQueries?    : boolean;
        startTransaction?   : boolean;
        logQueryText?       : boolean;
    }

    export interface PoolState {
        size        : number;
        available   : number;
    }

    export class Database extends events.EventEmitter {

        name: string;

        constructor(options: DatabaseOptions, logger?: Logger, SessionCtr?: typeof Session);

        connect(options?: SessionOptions): Promise<Session>;
        close(): Promise<any>;

        getPoolState(): PoolState;

        on(event: 'error', callback: (error: PgError) => void);
    }

    // SESSION
    // --------------------------------------------------------------------------------------------
    export class Session {
        isActive        : boolean;
        inTransaction   : boolean;
        
        startTransaction(lazy?: boolean)        : Promise<void>;
        release(action?: 'commit' | 'rollback') : Promise<void>;
        
        execute<T>(query: SingleResultQuery<T>) : Promise<T>
        execute<T>(query: ListResultQuery<T>)   : Promise<T[]>
        execute(query: Query)                   : Promise<void>;
        execute(queries: Query[])               : Promise<Map<string, any>>;
        
        constructor(dbName: string, client: any, options?: SessionOptions, logger?: Logger);
        
        protected dbName        : string;
        protected options       : SessionOptions;
        protected transaction   : TransactionState;
        protected logger?       : Logger;

        protected processQueryResult(query: Query, result: DbQueryResult): any[];
        protected rollbackAndRelease(reason?: any): Promise<any>;
        protected releaseConnection(error?: any);
    }

    // RESULT HANDLER
    // --------------------------------------------------------------------------------------------
    export interface ResultHandler<T> {
        parse(row: any): T;
    }

    // QUERY
    // --------------------------------------------------------------------------------------------
    export type QueryMask = 'list' | 'object';

    export interface QuerySpec {
        text    : string;
        name?   : string;
    }

    export interface Query extends QuerySpec{
        params? : any;
    }
    
    export interface SingleResultQuery<T> extends Query {
        mask    : 'object';
        handler?: ResultHandler<T>;
    }

    export interface ListResultQuery<T> extends Query {
        mask    : 'list';
        handler?: ResultHandler<T>;
    }

    export type ResultQuery<T> = SingleResultQuery<T> | ListResultQuery<T>;
    
    // SUPPORTING ENUMS AND INTERFACES
    // --------------------------------------------------------------------------------------------
    export const enum TransactionState {
        pending = 1, active
    }
    
    export interface DbQueryResult {
        rows: any[];
    }
    
    // ERROR CLASSES
    // --------------------------------------------------------------------------------------------
    export class PgError extends Error {
        cause: Error;
        
        constructor(cause: Error);
	    constructor(message: string, cause?: Error);
    }
	
    export class ConnectionError extends PgError {}
    export class TransactionError extends PgError {}
    export class QueryError extends PgError {}
    export class ParseError extends PgError {}

    // LOGGER
    // --------------------------------------------------------------------------------------------
    export interface Logger {
        debug(message: string);
        info(message: string);
        warn(message: string);

        error(error: Error);

        log(event: string, properties?: { [key: string]: any });
        track(metric: string, value: number);
        trace(service: string, command: string, time: number, success?: boolean);
    }
}