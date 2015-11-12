// IMPORTS
// ================================================================================================
import * as pg from 'pg';
import { ConnectionError } from './lib/errors'
import { Connection, Options } from './lib/Connection';
import { since } from './lib/util';

// INTERFACES
// ================================================================================================
export interface Settings {
    host        : string;
    port?       : number;
    user        : string;
    password    : string;
    database    : string;
    poolSize?   : number;
};

export interface PoolState {
    size        : number;
    available   : number;
}

export interface Configuration {
    connectionConstructor: typeof Connection,
    logger: Logger
}

export interface Logger {
    log(message: string): void;
}

export interface Utilities {
    since(start: number[]): number;
}

// GLOBALS
// ================================================================================================
var databases = new Map<string, Database>();

// export library configurations
export var config: Configuration = {
    connectionConstructor: Connection,
    logger: undefined
};

// export defaults to enable overriding
export var defaults: Options = {
    collapseQueries : false,
    startTransaction: false
};

// exported utils
export var utils: Utilities = {
    since: since
}

// database getter
export function db(settings: Settings): Database {
    var db = databases.get(JSON.stringify(settings));
    if (db === undefined) {
        db = new Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
};

// DATABASE CLASS
// ================================================================================================
export class Database {

    settings: Settings;
    
    constructor(settings: Settings) {
        this.settings = settings;
    }

    connect(options?: Options): Promise<Connection> {
        options = Object.assign({}, defaults, options);
        
        var start = process.hrtime();
        var logger = config.logger;
        logger && logger.log(`Connecting to the database; pool state ${this.getPoolDescription()}`)
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error) return reject(new ConnectionError(error));
                var connection = new config.connectionConstructor(this, options);
                connection.inject(client, done)
                logger && logger.log(`Connected in ${since(start)} ms; pool state: ${this.getPoolDescription()}`);
                resolve(connection);
            });
        });
    }

    getPoolState(): PoolState {
        var pool = pg.pools.getOrCreate(this.settings);
        return {
            size: pool.getPoolSize(),
            available: pool.availableObjectsCount()
        };
    }
    
    getPoolDescription(): string {
        var pool = pg.pools.getOrCreate(this.settings);
        return `{size: ${pool.getPoolSize()}, available: ${pool.availableObjectsCount()}}`;
    }
}

// RE-EXPORTS
// ================================================================================================
export { Connection } from './lib/Connection';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';