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
    cc          : typeof Connection,
    logger      : Logger,
    logQueryText: boolean;
}

export interface Logger {
    debug(message: string);
    info(message: string);
    warn(message: string);

    error(error: Error);

    log(event: string, properties?: { [key: string]: any });
    track(metric: string, value: number);
    trace(service: string, command: string, time: number, success?: boolean);
}

export interface Utilities {
    since(start: number[]): number;
}

// GLOBALS
// ================================================================================================
const databases = new Map<string, Database>();

// export library configurations
export const config: Configuration = {
    cc          : Connection,
    logger      : undefined,
    logQueryText: false
};

// export defaults to enable overriding
export const defaults: Options = {
    collapseQueries : false,
    startTransaction: false
};

// exported utils
export const utils: Utilities = {
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

    name    : string;
    pool    : pg.ClientPool;
    settings: Settings;

    constructor(settings: Settings) {
        this.name = settings.database;
        this.settings = settings;
        this.pool = pg.pools.getOrCreate(this.settings);
    }

    connect(options?: Options): Promise<Connection> {
        options = Object.assign({}, defaults, options);
        
        const start = process.hrtime();
        const logger = config.logger;
        logger && logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`)
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error) return reject(new ConnectionError(error));
                const connection = new config.cc(this, options);
                connection.inject(client, done)
        
                logger && logger.log(`${this.name}::connected`, {
                    connectionTime  : since(start),
                    poolSize        : this.pool.getPoolSize(),
                    poolAvailable   : this.pool.availableObjectsCount()
                });
                resolve(connection);
            });
        });
    }

    getPoolState(): PoolState {
        return {
            size        : this.pool.getPoolSize(),
            available   : this.pool.availableObjectsCount()
        };
    }
    
    getPoolDescription(): string {
        return `{ size: ${this.pool.getPoolSize()}, available: ${this.pool.availableObjectsCount()} }`;
    }
}

// RE-EXPORTS
// ================================================================================================
export { Connection } from './lib/Connection';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';