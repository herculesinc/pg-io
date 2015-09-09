// IMPORTS
// ================================================================================================
var pg = require('pg');
var Connection_1 = require('./lib/Connection');
;
// GLOBALS
// ================================================================================================
pg.defaults.parseInt8 = true;
var databases = new Map();
exports.defaults = {
    collapseQueries: true
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
        // TODO: use a better way to merge options
        options = options || exports.defaults;
        if ('collapseQueries' in options === false) {
            options.collapseQueries = exports.defaults.collapseQueries;
        }
        return new Promise(function (resolve, reject) {
            pg.connect(_this.settings, function (err, client, done) {
                if (err)
                    return reject(err);
                var dao = new Connection_1.Connection(options, client, done);
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
//# sourceMappingURL=index.js.map