"use strict";
// IMPORTS
// ================================================================================================
const Database_1 = require('./lib/Database');
const util_1 = require('./lib/util');
// GLOBALS
// ================================================================================================
const databases = new Map();
// exported utils
exports.utils = {
    since: util_1.since
};
// database getter
function db(options) {
    var db = databases.get(JSON.stringify(options.connection));
    if (db === undefined) {
        options = Object.assign({}, options);
        db = new Database_1.Database(options);
        databases.set(JSON.stringify(options.connection), db);
    }
    return db;
}
exports.db = db;
// RE-EXPORTS
// ================================================================================================
var defaults_1 = require('./lib/defaults');
exports.defaults = defaults_1.defaults;
var Session_1 = require('./lib/Session');
exports.Session = Session_1.Session;
var errors_1 = require('./lib/errors');
exports.PgError = errors_1.PgError;
exports.ConnectionError = errors_1.ConnectionError;
exports.TransactionError = errors_1.TransactionError;
exports.QueryError = errors_1.QueryError;
exports.ParseError = errors_1.ParseError;
//# sourceMappingURL=index.js.map