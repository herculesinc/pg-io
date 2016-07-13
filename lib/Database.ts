// IMPORTS
// ================================================================================================
import * as pg from 'pg';
import { defaults, config } from './../index';
import { ConnectionError } from './errors';
import { Connection, Options as ConnectionOptions } from './Connection';
import { since } from './util';

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
    size            : number;
    available       : number;
}

// DATABASE CLASS
// ================================================================================================
export class Database {

    name    : string;
    pool    : pg.Pool;
    settings: Settings;

    constructor(settings: Settings) {
        this.name = settings.database;
        this.settings = settings;
        this.pool = new pg.Pool(settings);
    }

    connect(options?: ConnectionOptions): Promise<Connection> {
        options = Object.assign({}, defaults, options);
        
        const start = process.hrtime();
        const logger = config.logger;
        logger && logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.connect((error, client, done) => {
                if (error) return reject(new ConnectionError(error));
                const connection = new config.cc(client, options);
    
                logger && logger.log(`${this.name}::connected`, {
                    connectionTime  : since(start),
                    poolSize        : this.pool.pool.getPoolSize(),
                    poolAvailable   : this.pool.pool.availableObjectsCount()
                });
                resolve(connection);
            });
        });
    }

    getPoolState(): PoolState {
        return {
            size        : this.pool.pool.getPoolSize(),
            available   : this.pool.pool.availableObjectsCount()
        };
    }
    
    getPoolDescription(): string {
        return `{ size: ${this.pool.pool.getPoolSize()}, available: ${this.pool.pool.availableObjectsCount()} }`;
    }
}