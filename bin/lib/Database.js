"use strict";
// IMPORTS
// ================================================================================================
const pg_1 = require('pg');
const generic_pool_1 = require('generic-pool');
const errors_1 = require('./errors');
const defaults_1 = require('./defaults');
const util_1 = require('./util');
// DATABASE CLASS
// ================================================================================================
class Database {
    constructor(settings) {
        //this.name = settings.database;
        this.logger = defaults_1.defaults.logger;
        this.Session = defaults_1.defaults.SessionConstructor;
        // 
        this.settings = Object.assign({}, defaults_1.defaults.connection, settings.connection);
        // initialize client poool
        const poolOptions = Object.assign({}, defaults_1.defaults.pool, settings.pool);
        this.pool = new generic_pool_1.Pool(new ClientFactory(this, poolOptions));
    }
    connect(options) {
        options = Object.assign({}, defaults_1.defaults.connection, options);
        const start = process.hrtime();
        this.logger && this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, client) => {
                if (error)
                    return reject(new errors_1.ConnectionError(error));
                client.release = (error) => {
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
                    connectionTime: util_1.since(start),
                    poolSize: this.pool.getPoolSize(),
                    poolAvailable: this.pool.availableObjectsCount()
                });
                resolve(connection);
            });
        });
    }
    close() {
        return new Promise((resolve, reject) => {
            this.pool.drain(() => {
                this.pool.destroyAllNow();
                resolve();
            });
        });
    }
    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState() {
        return {
            size: this.pool.getPoolSize(),
            available: this.pool.availableObjectsCount()
        };
    }
    getPoolDescription() {
        return `{ size: ${this.pool.getPoolSize()}, available: ${this.pool.availableObjectsCount()} }`;
    }
}
exports.Database = Database;
// CLIENT FACTORY CLASS
// ================================================================================================
class ClientFactory {
    constructor(database, options) {
        this.database = database;
        if (options) {
            this.min = 0;
            this.max = options.maxSize;
            this.refreshIdle = (options.idleTimeout > 0);
            this.idleTimeoutMillis = options.idleTimeout;
            this.reapIntervalMillis = options.reapInterval;
        }
    }
    create(callback) {
        const client = new pg_1.Client(this.database.settings);
        client.on('error', error => {
            this.database.pool.destroy(client);
            // TODO: emit connection error
        });
        client.connect(error => callback(error, error ? undefined : client));
    }
    destroy(client) {
        if (client._destroying)
            return;
        client._destroying = true;
        client.end();
    }
}
//# sourceMappingURL=Database.js.map