// IMPORTS
// ================================================================================================
import * as events from 'events';
import * as pg from 'pg';
import { ConnectionError } from './errors';
import { ConnectionPool } from './Pool';
import { Session, SessionOptions } from './Session';
import { defaults } from './defaults';
import { Logger, buildLogger, DbLogger } from './util';

// MODULE VARIABLES
// ================================================================================================
export const ERROR_EVENT = 'error';

// INTERFACES
// ================================================================================================
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
    database        : string;
    user            : string;
    password        : string;
}

export interface PoolOptions {
    log?               : (data: any) => void;
    maxSize?           : number;
    idleTimeout?       : number;
    connectionTimeout? : number;
}

export interface PoolState {
    size    : number;
    idle    : number;
}

// DATABASE CLASS
// ================================================================================================
export class Database extends events.EventEmitter {

    readonly name       : string;
    readonly pool       : ConnectionPool;
    readonly logger     : DbLogger;
    readonly Session    : typeof Session;
    readonly sOptions   : SessionOptions;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(options: DatabaseOptions, logger?: Logger, SessionCtr?: typeof Session) {
        super();

        if (!options) throw TypeError('Cannot create a Database: options are undefined');
        if (!options.connection) throw TypeError('Cannot create a Database: connection options are undefined');

        // set basic properties
        this.name = options.name || defaults.name;
        this.Session = SessionCtr || defaults.SessionCtr;
        this.sOptions = validateSessionOptions(options.session);
        this.logger = buildLogger(this.name, logger);

        // initialize connection pool
        const connectionOptions = validateConnectionOptions(options.connection);
        this.pool = new ConnectionPool(options.pool, connectionOptions, this.logger);

        this.pool.on('error', (error) => {
            this.emit(ERROR_EVENT, error);
        });
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    connect(options?: SessionOptions): Promise<Session> {
        options = validateSessionOptions(options);

        const start = process.hrtime();

        this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, client) => {
                this.logger.trace('acquire connection', start, !error);
                if (error) {
                    reject(new ConnectionError(error));
                }
                else {
                    const session = new this.Session(client, options, this.logger);
                    resolve(session);
                }
            });
        });
    }

    close(): Promise<any> {
        const start = process.hrtime();
        this.logger.debug(`Closing database; pool state ${this.getPoolDescription()}`)
        return new Promise((resolve, reject) => {
            this.pool.shutdown((error) => {
                this.logger.trace('close database', start, !error);
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }

    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState(): PoolState {
        return {
            size    : this.pool.totalCount,
            idle    : this.pool.idleCount
        };
    }

    getPoolDescription(): string {
        return `{ size: ${this.pool.totalCount}, idle: ${this.pool.idleCount} }`;
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function validateConnectionOptions(options: ConnectionSettings): ConnectionSettings {
    options = Object.assign({}, defaults.connection, options);

    if (typeof options.host !== 'string') throw new TypeError('Connection options are invalid');
    if (typeof options.port !== 'number') throw new TypeError('Connection options are invalid');
    if (typeof options.ssl !== 'boolean') throw new TypeError('Connection options are invalid');
    if (typeof options.database !== 'string') throw new TypeError('Connection options are invalid');
    if (typeof options.user !== 'string') throw new TypeError('Connection options are invalid');
    if (typeof options.password !== 'string') throw new TypeError('Connection options are invalid');

    return options;
}

function validateSessionOptions(options: SessionOptions): SessionOptions {
    options = Object.assign({}, defaults.session, options);

    if (typeof options.startTransaction !== 'boolean') throw new TypeError('Session options are invalid');
    if (typeof options.collapseQueries !== 'boolean') throw new TypeError('Session options are invalid');
    if (typeof options.logQueryText !== 'boolean') throw new TypeError('Session options are invalid');

    if (typeof options.timeout !== 'number') throw new TypeError('Session options are invalid');
    if (options.timeout <= 0) throw new TypeError('Session options are invalid');
    if (!Number.isInteger(options.timeout)) throw new TypeError('Session options are invalid');

    return options;
}
