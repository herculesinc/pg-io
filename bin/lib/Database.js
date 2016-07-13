"use strict";
// IMPORTS
// ================================================================================================
const pg = require('pg');
const index_1 = require('./../index');
const errors_1 = require('./errors');
const util_1 = require('./util');
;
// DATABASE CLASS
// ================================================================================================
class Database {
    constructor(settings) {
        this.name = settings.database;
        this.settings = settings;
        this.pool = new pg.Pool(settings);
    }
    connect(options) {
        options = Object.assign({}, index_1.defaults, options);
        const start = process.hrtime();
        const logger = index_1.config.logger;
        logger && logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.connect((error, client, done) => {
                if (error)
                    return reject(new errors_1.ConnectionError(error));
                const connection = new index_1.config.cc(client, options);
                logger && logger.log(`${this.name}::connected`, {
                    connectionTime: util_1.since(start),
                    poolSize: this.pool.pool.getPoolSize(),
                    poolAvailable: this.pool.pool.availableObjectsCount()
                });
                resolve(connection);
            });
        });
    }
    getPoolState() {
        return {
            size: this.pool.pool.getPoolSize(),
            available: this.pool.pool.availableObjectsCount()
        };
    }
    getPoolDescription() {
        return `{ size: ${this.pool.pool.getPoolSize()}, available: ${this.pool.pool.availableObjectsCount()} }`;
    }
}
exports.Database = Database;
//# sourceMappingURL=Database.js.map