// IMPORTS
// ================================================================================================
import { Client} from 'pg';
import { Factory, Pool } from 'generic-pool';
import { ConnectionError } from './errors';
import { Session, SessionOptions } from './Session';
import { defaults } from './defaults';
import { since, Logger } from './util';

// INTERFACES
// ================================================================================================
export interface DatabaseOptions {
    application?: string;
    connection  : ConnectionSettings;
    pool?       : PoolOptions;
}

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

export interface PoolState {
    size            : number;
    available       : number;
}

// DATABASE CLASS
// ================================================================================================
export class Database {

    name        : string;
    pool        : Pool<Client>;
    logger      : Logger;
    Session     : typeof Session;
    settings    : ConnectionSettings;

    constructor(settings: DatabaseOptions) {
        //this.name = settings.database;
        this.logger = defaults.logger;
        this.Session = defaults.SessionConstructor;

        // 
        this.settings = Object.assign({}, defaults.connection, settings.connection);

        // initialize client poool
        const poolOptions = Object.assign({}, defaults.pool, settings.pool);
        this.pool = new Pool(new ClientFactory(this, poolOptions));
    }

    connect(options?: SessionOptions): Promise<Session> {
        options = Object.assign({}, defaults.connection, options);
        
        const start = process.hrtime();
        
        this.logger && this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, client) => {
                if (error) return reject(new ConnectionError(error));

                client.release = (error?: Error) => {
                    delete client.release;
                    if (error) {
                        // emit and log event
                        this.pool.destroy(client);
                    }
                    else {
                        // emit and log event
                        this.pool.release(client);
                    }
                };

                const connection = new this.Session(client, options);

                this.logger && this.logger.log(`${this.name}::connected`, {
                    connectionTime  : since(start),
                    poolSize        : this.pool.getPoolSize(),
                    poolAvailable   : this.pool.availableObjectsCount()
                });

                resolve(connection);
            });
        });
    }

    close(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.pool.drain(() => {
                this.pool.destroyAllNow();
                resolve();
            });
        });
    }

    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
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

// CLIENT FACTORY CLASS
// ================================================================================================
class ClientFactory implements Factory<Client> {

    database            : Database;

    min?                : number;
    max?                : number;
    refreshIdle?        : boolean;
    idleTimeoutMillis?  : number;
    reapIntervalMillis? : number;

    constructor(database: Database, options?: PoolOptions) {
        this.database = database;
        if (options) {
            this.min = 0;
            this.max = options.maxSize;
            this.refreshIdle = (options.idleTimeout > 0);
            this.idleTimeoutMillis = options.idleTimeout;
            this.reapIntervalMillis = options.reapInterval;
        }
    }

    create(callback: (error: Error | void, client?: Client) => void): void {
        const client = new Client(this.database.settings);
        client.on('error', error => {
            this.database.pool.destroy(client);
            // TODO: emit connection error
        });

        client.connect(error => callback(error, error ? undefined : client));
    }

    destroy(client: Client): void {
        if (client._destroying) return;
        client._destroying = true;
        client.end();
    }
}