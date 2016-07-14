declare module "pg-io" {

    // GLOBAL
    // --------------------------------------------------------------------------------------------
    export interface ConnectionSettings {
        host        : string;
        port?       : number;
        user        : string;
        password    : string;
        database    : string;
    }
    
    export interface PoolOptions {
        maxSize?        : number;
        idleTimeout?    : number;
        reapInterval?   : number;
    }

    export interface DatabaseOptions {
        application?: string;
        connection  : ConnectionSettings;
        pool?       : PoolOptions;
    }

    export interface Defaults {
        application         : string;
        SessionConstructor  : typeof Session;
        connection          : ConnectionSettings;
        session             : SessionOptions;
        pool                : PoolOptions;
        logger              : Logger;
    }

    export interface Utilities {
        since(start: number[]): number;
    }

    export function db(options: DatabaseOptions): Database;
    export const defaults: Defaults;
    export const utils: Utilities;

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

    export interface Database {
        connect(options?: SessionOptions): Promise<Session>;
        close(): Promise<any>;

        getPoolState(): PoolState;
    }

    // SESSION
    // --------------------------------------------------------------------------------------------
    export class Session {
        isActive        : boolean;
        inTransaction   : boolean;
        
        startTransaction(lazy?: boolean)        : Promise<void>;
        
        release(action: 'commit')               : Promise<void>;
        release(action: 'rollback')             : Promise<void>;
        release()                               : Promise<any>;

        execute<T>(query: SingleResultQuery<T>) : Promise<T>
        execute<T>(query: ListResultQuery<T>)   : Promise<T[]>
        execute<T>(query: ResultQuery<T>)       : Promise<any>;
        execute(query: Query)                   : Promise<void>;
        execute(queries: Query[])               : Promise<Map<string, any>>;
        
        constructor(client: any, options?: SessionOptions);
        
        protected options: SessionOptions;
        protected transaction: TransactionState;
        protected processQueryResult(query: Query, result: DbQueryResult): any[];
        protected rollbackAndRelease(reason?: any): Promise<any>;
        protected releaseConnection(error?: any);
        protected logger: Logger;
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
    const enum TransactionState {
        pending = 1, active
    }
    
    interface DbQueryResult {
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