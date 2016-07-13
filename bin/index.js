"use strict";
// IMPORTS
// ================================================================================================
const Connection_1 = require('./lib/Connection');
const Database_1 = require('./lib/Database');
const util_1 = require('./lib/util');
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
        db = new Database_1.Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
}
exports.db = db;
;
// RE-EXPORTS
// ================================================================================================
var Connection_2 = require('./lib/Connection');
exports.Connection = Connection_2.Connection;
var errors_1 = require('./lib/errors');
exports.PgError = errors_1.PgError;
exports.ConnectionError = errors_1.ConnectionError;
exports.TransactionError = errors_1.TransactionError;
exports.QueryError = errors_1.QueryError;
exports.ParseError = errors_1.ParseError;
//# sourceMappingURL=index.js.map