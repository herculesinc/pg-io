declare module "pg-io" {

    // IMPORTS
    // --------------------------------------------------------------------------------------------
    import * as events from 'events';

    // GLOBAL
    // --------------------------------------------------------------------------------------------
    export interface DatabaseOptions {
        name?           : string;
        pool?           : PoolOptions;
        session?        : SessionOptions;
        connection      : ConnectionSettings;
    }

    export interface ConnectionSettings {
        host            : string;
        port?           : number;
        ssl?            : boolean;
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
        isActive    : boolean;
        isReadOnly  : boolean;
        
        close(action?: 'commit' | 'rollback')   : Promise<void>;
        
        execute<T>(query: SingleResultQuery<T>) : Promise<T>;
        execute<T>(query: ListResultQuery<T>)   : Promise<T[]>;
        execute(query: Query<void>)             : Promise<void>;
        
        constructor(dbName: string, client: any, options: SessionOptions, logger?: Logger);
        
        protected dbName        : string;
        protected options       : SessionOptions;
        protected transaction   : TransactionState;
        protected logger?       : Logger;
        protected closing       : boolean;

        protected processQueryResult(query: Query<any>, result: DbQueryResult): any[];
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
    export type QueryMask = 'list' | 'single';
    export type QueryMode = 'object' | 'array';

    export interface Query<T> {
        readonly text       : string;
        readonly name?      : string;
        readonly mode?      : QueryMode;
        readonly mask?      : QueryMask;
        readonly values?    : any[];
        readonly handler?   : ResultHandler<T>;
    }

    export const Query: {
        from(text: string): Query<void>;
        from(text: string, name: string): Query<void>;
        from<T>(text: string, options?: ListResultQueryOptions<T>): ListResultQuery<T>;
        from<T>(text: string, name: string, options?: ListResultQueryOptions<T>): ListResultQuery<T>;
        from<T>(text: string, options?: SingleResultQueryOptions<T>): SingleResultQuery<T>;
        from<T>(text: string, name: string, options?: SingleResultQueryOptions<T>): SingleResultQuery<T>;

        template(text: string): QueryTemplate<Query<void>>;
        template(text: string, name: string): QueryTemplate<Query<void>>;
        template<T>(text: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>;
        template<T>(text: string, name: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>;
        template<T>(text: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>;
        template<T>(text: string, name: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>;
    }
    
    export interface ResultQuery<T> extends Query<T> {
        readonly mask       : QueryMask;
        readonly mode?      : QueryMode;
        readonly handler?   : ResultHandler<T>;
    }
    
    export interface SingleResultQuery<T> extends ResultQuery<T> {
        readonly mask       : 'single';
    }
    
    export interface ListResultQuery<T> extends ResultQuery<T> {
        readonly mask       : 'list';
    }
    
    export interface ResultQueryOptions<T> {
        readonly mask       : QueryMask;
        readonly mode?      : QueryMode;
        readonly handler?   : ResultHandler<T>;
    }
    
    export interface SingleResultQueryOptions<T> extends ResultQueryOptions<T> {
        readonly mask       : 'single';
        readonly mode?      : QueryMode;
        readonly handler?   : ResultHandler<T>;
    }
    
    export interface ListResultQueryOptions<T> extends ResultQueryOptions<T> {
        readonly mask       : 'list';
        readonly mode?      : QueryMode;
        readonly handler?   : ResultHandler<T>;
    }
    
    export interface QueryTemplate<T extends Query<any>> {
        new(params: object): T;
    }

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
        debug(message: string, source?: string);
        info(message: string, source?: string);
        warn(message: string, source?: string);
        trace(source: string, command: string, time: number, success?: boolean);
    }
}