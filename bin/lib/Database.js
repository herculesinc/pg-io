"use strict";
// IMPORTS
// ================================================================================================
const pg_1 = require('pg');
const generic_pool_1 = require('generic-pool');
const errors_1 = require('./errors');
const defaults_1 = require('./defaults');
const util_1 = require('./util');
// MODULE VARIABLES
// ================================================================================================
const ERROR_EVENT = 'error';
// DATABASE CLASS
// ================================================================================================
class Database {
    constructor(options, logger) {
        if (!options)
            throw TypeError('Cannot create a Database: options are undefined');
        if (!options.connection)
            throw TypeError('Cannot create a Database: connection settings are undefined');
        // set basic properties
        this.name = options.name || defaults_1.defaults.name;
        this.Session = defaults_1.defaults.SessionCtr;
        this.logger = logger;
        // initialize client poool
        const connectionSettings = Object.assign({}, defaults_1.defaults.connection, options.connection);
        const poolOptions = Object.assign({}, defaults_1.defaults.pool, options.pool);
        this.pool = new generic_pool_1.Pool(new ClientFactory(this, connectionSettings, poolOptions));
    }
    connect(options) {
        options = Object.assign({}, defaults_1.defaults.session, options);
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
                const session = new this.Session(client, options, this.logger);
                this.logger && this.logger.log(`${this.name}::connected`, {
                    connectionTime: util_1.since(start),
                    poolSize: this.pool.getPoolSize(),
                    poolAvailable: this.pool.availableObjectsCount()
                });
                // TODO: fire connected event
                resolve(session);
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
    constructor(database, settings, options) {
        this.database = database;
        this.settings = settings;
        if (options) {
            this.min = 0;
            this.max = options.maxSize;
            this.refreshIdle = (options.idleTimeout > 0);
            this.idleTimeoutMillis = options.idleTimeout;
            this.reapIntervalMillis = options.reapInterval;
        }
    }
    create(callback) {
        const client = new pg_1.Client(this.settings);
        client.on('error', error => {
            this.database.pool.destroy(client);
            // TODO: emit error event
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