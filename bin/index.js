// IMPORTS
// ================================================================================================
'use strict';

var pg = require('pg');
var errors_1 = require('./lib/errors');
var Connection_1 = require('./lib/Connection');
var util_1 = require('./lib/util');
;
// GLOBALS
// ================================================================================================
var databases = new Map();
// export connection contructor to enable overriding
exports.constructors = {
    connection: Connection_1.Connection
};
// export defaults to enable overriding
exports.defaults = {
    collapseQueries: false,
    startTransaction: false
};
// noop logger - can be replaced with real logger
exports.logger = {
    log: message => {}
};
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
        this.settings = settings;
    }
    connect(options) {
        options = Object.assign({}, exports.defaults, options);
        var start = process.hrtime();
        exports.logger.log('Connecting to the database');
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error) return reject(new errors_1.ConnectionError(error));
                var connection = new exports.constructors.connection(options, client, done);
                exports.logger.log(`Connected in ${ util_1.since(start) } ms; pool state: ${ this.getPoolDescription() }`);
                resolve(connection);
            });
        });
    }
    getPoolState() {
        var pool = pg.pools.getOrCreate(this.settings);
        return {
            size: pool.getPoolSize(),
            available: pool.availableObjectsCount()
        };
    }
    getPoolDescription() {
        var pool = pg.pools.getOrCreate(this.settings);
        return `{size: ${ pool.getPoolSize() }, available: ${ pool.availableObjectsCount() }}`;
    }
}
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
//# sourceMappingURL=../bin/index.js.map