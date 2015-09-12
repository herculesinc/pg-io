declare module "pg-io" {

    // GLOBAL
    // --------------------------------------------------------------------------------------------
    export interface ConnectionSettings {
        host        : string;
        port?       : number;
        user        : string;
        password    : string;
        database    : string;
        poolSize?   : number;
    }

    export function db(settings: ConnectionSettings): Database;
    export var defaults: ConnectionOptions;
    export var ConnectionConstructor: typeof Connection;

    // DATABASE
    // --------------------------------------------------------------------------------------------
    export interface ConnectionOptions {
        collapseQueries?    : boolean;
        startTransaction?   : boolean;
    }

    export interface PoolState {
        size        : number;
        available   : number;
    }

    export interface Database {
        connect(options?: ConnectionOptions): Promise<Connection>;
        getPoolState(): PoolState;
    }

    // CONNECTION
    // --------------------------------------------------------------------------------------------
    export class Connection {
        isActive        : boolean;
        inTransaction   : boolean;
        
        startTransaction(lazy?: boolean)    : Promise<void>;
        
        release(action: 'commit')           : Promise<void>;
        release(action: 'rollback')         : Promise<void>;
        release(action?: string)            : Promise<any>;

        execute<T>(query: ResultQuery<T>)   : Promise<any>;
        execute(query: Query)               : Promise<void>;
        execute(queries: Query[])           : Promise<Map<string,any>>;
        
        constructor(options: ConnectionOptions, client: any, done: (error?: Error) => void);
        
        protected state: ConnectionState;
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
    export interface Query {
        text    : string;
        name?   : string;
        params? : any;
    }
    
    export interface ResultQuery<T> extends Query {
        mask    : string;
        handler?: ResultHandler<T>;
    }
    
    // SUPPORTING ENUMS AND INTERFACES
    // --------------------------------------------------------------------------------------------
    enum ConnectionState {
        connection = 1,
        transaction,
        transactionPending,
        released
    }
    
    interface DbQueryResult {
        rows: any[];
    }
}