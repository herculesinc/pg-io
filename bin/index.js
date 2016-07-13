"use strict";
// IMPORTS
// ================================================================================================
const pg = require('pg');
const errors_1 = require('./lib/errors');
const Connection_1 = require('./lib/Connection');
const util_1 = require('./lib/util');
;
// GLOBALS
// ================================================================================================
const databases = new Map();
// export library configurations
exports.config = {
    cc: Connection_1.Connection,
    logger: undefined,
    logQueryText: false
};
// export defaults to enable overriding
exports.defaults = {
    collapseQueries: false,
    startTransaction: false
};
// exported utils
exports.utils = {
    since: util_1.since
};
// database getter
function db(settings) {
    var db = databases.get(JSON.stringify(settings));
    if (db === undefined) {
        db = new Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
}
exports.db = db;
;
// DATABASE CLASS
// ================================================================================================
class Database {
    constructor(settings) {
        this.name = settings.database;
        this.settings = settings;
        this.pool = pg.pools.getOrCreate(this.settings);
    }
    connect(options) {
        options = Object.assign({}, exports.defaults, options);
        const start = process.hrtime();
        const logger = exports.config.logger;
        logger && logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error)
                    return reject(new errors_1.ConnectionError(error));
                const connection = new exports.config.cc(this, options);
                connection.inject(client, done);
                logger && logger.log(`${this.name}::connected`, {
                    connectionTime: util_1.since(start),
                    poolSize: this.pool.getPoolSize(),
                    poolAvailable: this.pool.availableObjectsCount()
                });
                resolve(connection);
            });
        });
    }
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
// RE-EXPORTS
// ================================================================================================
var Connection_2 = require('./lib/Connection');
exports.Connection = Connection_2.Connection;
var errors_2 = require('./lib/errors');
exports.PgError = errors_2.PgError;
exports.ConnectionError = errors_2.ConnectionError;
exports.TransactionError = errors_2.TransactionError;
exports.QueryError = errors_2.QueryError;
exports.ParseError = errors_2.ParseError;
//# sourceMappingURL=index.js.map