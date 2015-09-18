// IMPORTS
// ================================================================================================
'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.db = db;
// needed for Babel transpilation

var _libErrors = require('./lib/errors');

var _libConnection = require('./lib/Connection');

var pg = require('pg');
;
// GLOBALS
// ================================================================================================
pg.defaults.parseInt8 = true;
var databases = new Map();
// export connection contructor to enable overriding
var ConnectionConstructor;
exports.ConnectionConstructor = ConnectionConstructor;
exports.ConnectionConstructor = ConnectionConstructor = _libConnection.Connection;
// export defaults to enable overriding
var defaults;
exports.defaults = defaults;
exports.defaults = defaults = {
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

;
// DATABASE CLASS
// ================================================================================================
class Database {
    constructor(settings) {
        this.settings = settings;
    }
    connect(options) {
        options = Object.assign({}, defaults, options);
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error) return reject(new _libErrors.ConnectionError(error));
                var connection = new ConnectionConstructor(options, client, done);
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
}
// RE-EXPORTS
// ================================================================================================
Object.defineProperty(exports, 'Connection', {
    enumerable: true,
    get: function get() {
        return _libConnection.Connection;
    }
});
Object.defineProperty(exports, 'PgError', {
    enumerable: true,
    get: function get() {
        return _libErrors.PgError;
    }
});
Object.defineProperty(exports, 'ConnectionError', {
    enumerable: true,
    get: function get() {
        return _libErrors.ConnectionError;
    }
});
Object.defineProperty(exports, 'TransactionError', {
    enumerable: true,
    get: function get() {
        return _libErrors.TransactionError;
    }
});
Object.defineProperty(exports, 'QueryError', {
    enumerable: true,
    get: function get() {
        return _libErrors.QueryError;
    }
});
Object.defineProperty(exports, 'ParseError', {
    enumerable: true,
    get: function get() {
        return _libErrors.ParseError;
    }
});
//# sourceMappingURL=../bin/index.js.map