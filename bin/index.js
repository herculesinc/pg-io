// IMPORTS
// ================================================================================================
var pg = require('pg');
var errors_1 = require('./lib/errors');
var Connection_1 = require('./lib/Connection');
;
// GLOBALS
// ================================================================================================
pg.defaults.parseInt8 = true;
var databases = new Map();
exports.ConnectionConstructor = Connection_1.Connection;
exports.defaults = {
    collapseQueries: false,
    startTransaction: false
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
// DATABASE CLASS
// ================================================================================================
var Database = (function () {
    function Database(settings) {
        this.settings = settings;
    }
    Database.prototype.connect = function (options) {
        var _this = this;
        // TODO: use Object.assign() to merge options
        if (options) {
            for (var option in exports.defaults) {
                options[option] = (options[option] === undefined) ? exports.defaults[option] : options[option];
            }
        }
        else {
            options = exports.defaults;
        }
        return new Promise(function (resolve, reject) {
            pg.connect(_this.settings, function (error, client, done) {
                if (error)
                    return reject(new errors_1.ConnectionError(error));
                var dao = new exports.ConnectionConstructor(options, client, done);
                resolve(dao);
            });
        });
    };
    Database.prototype.getPoolState = function () {
        var pool = pg.pools.getOrCreate(this.settings);
        return {
            size: pool.getPoolSize(),
            available: pool.availableObjectsCount()
        };
    };
    return Database;
})();
// RE-EXPORTS
// ================================================================================================
var Connection_2 = require('./lib/Connection');
exports.Connection = Connection_2.Connection;
var errors_2 = require('./lib/errors');
exports.PgError = errors_2.PgError;
exports.ConnectionError = errors_2.ConnectionError;
exports.ConnectionStateError = errors_2.ConnectionStateError;
exports.QueryError = errors_2.QueryError;
exports.ParseError = errors_2.ParseError;
//# sourceMappingURL=index.js.map