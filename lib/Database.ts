// IMPORTS
// ================================================================================================
import * as pg from 'pg';
import { ConnectionError } from './errors';
import { Session, SessionOptions } from './Session';
import { defaults } from './defaults';
import { since, Logger } from './util';

// MODULE VARIABLES
// ================================================================================================
const ERROR_EVENT = 'error';

// INTERFACES
// ================================================================================================
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

export interface PoolState {
    size            : number;
    available       : number;
}

// DATABASE CLASS
// ================================================================================================
export class Database {

    name        : string;
    pgPool      : pg.Pool;
    logger?     : Logger;
    Session     : typeof Session;

    constructor(options: DatabaseOptions, logger?: Logger) {

        if (!options) throw TypeError('Cannot create a Database: options are undefined');
        if (!options.connection) throw TypeError('Cannot create a Database: connection settings are undefined');

        // set basic properties
        this.name = options.name || defaults.name;
        this.Session = defaults.SessionCtr;
        this.logger = logger;

        // initialize client pool
        const connectionSettings = Object.assign({}, defaults.connection, options.connection);
        const poolOptions = Object.assign({}, defaults.pool, options.pool);
        this.pgPool = new pg.Pool(buildPgPoolOptions(connectionSettings, poolOptions));
    }

    connect(options?: SessionOptions): Promise<Session> {
        options = Object.assign({}, defaults.session, options);
        
        const start = process.hrtime();
        
        this.logger && this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pgPool.connect((error, client) => {
                if (error) return reject(new ConnectionError(error));

                const session = new this.Session(client, options, this.logger);

                this.logger && this.logger.log(`${this.name}::connected`, {
                    connectionTime  : since(start),
                    poolSize        : this.pgPool.pool.getPoolSize(),
                    poolAvailable   : this.pgPool.pool.availableObjectsCount()
                });
                // TODO: fire connected event
                resolve(session);
            });
        });
    }

    close(): Promise<any> {
        return this.pgPool.end();
    }

    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState(): PoolState {
        return {
            size        : this.pgPool.pool.getPoolSize(),
            available   : this.pgPool.pool.availableObjectsCount()
        };
    }
    
    getPoolDescription(): string {
        return `{ size: ${this.pgPool.pool.getPoolSize()}, available: ${this.pgPool.pool.availableObjectsCount()} }`;
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function buildPgPoolOptions(conn: ConnectionSettings, pool: PoolOptions): pg.ClientConfig {
    return {
        host        : conn.host,
        port        : conn.port,
        user        : conn.user,
        password    : conn.password,
        database    : conn.database,
        max                 : pool.maxSize,
        idleTimeoutMillis   : pool.idleTimeout,
        reapIntervalMillis  : pool.reapInterval
    };
}