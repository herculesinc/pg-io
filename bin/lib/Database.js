"use strict";
// IMPORTS
// ================================================================================================
const pg = require('pg');
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
        // initialize client pool
        const connectionSettings = Object.assign({}, defaults_1.defaults.connection, options.connection);
        const poolOptions = Object.assign({}, defaults_1.defaults.pool, options.pool);
        this.pgPool = new pg.Pool(buildPgPoolOptions(connectionSettings, poolOptions));
    }
    connect(options) {
        options = Object.assign({}, defaults_1.defaults.session, options);
        const start = process.hrtime();
        this.logger && this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pgPool.connect((error, client) => {
                if (error)
                    return reject(new errors_1.ConnectionError(error));
                const session = new this.Session(client, options, this.logger);
                this.logger && this.logger.log(`${this.name}::connected`, {
                    connectionTime: util_1.since(start),
                    poolSize: this.pgPool.pool.getPoolSize(),
                    poolAvailable: this.pgPool.pool.availableObjectsCount()
                });
                // TODO: fire connected event
                resolve(session);
            });
        });
    }
    close() {
        return this.pgPool.end();
    }
    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState() {
        return {
            size: this.pgPool.pool.getPoolSize(),
            available: this.pgPool.pool.availableObjectsCount()
        };
    }
    getPoolDescription() {
        return `{ size: ${this.pgPool.pool.getPoolSize()}, available: ${this.pgPool.pool.availableObjectsCount()} }`;
    }
}
exports.Database = Database;
// HELPER FUNCTIONS
// ================================================================================================
function buildPgPoolOptions(conn, pool) {
    return {
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        max: pool.maxSize,
        idleTimeoutMillis: pool.idleTimeout,
        reapIntervalMillis: pool.reapInterval
    };
}
//# sourceMappingURL=Database.js.map