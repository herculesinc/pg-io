var Query_1 = require('./Query');
var Collector_1 = require('./Collector');
var errors_1 = require('./errors');
var State;
(function (State) {
    State[State["connection"] = 1] = "connection";
    State[State["transaction"] = 2] = "transaction";
    State[State["transactionPending"] = 3] = "transactionPending";
    State[State["released"] = 4] = "released";
})(State || (State = {}));
// CONNECTION CLASS DEFINITION
// ================================================================================================
var Connection = (function () {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    function Connection(options, client, done) {
        this.options = options;
        this.client = client;
        this.done = done;
        if (options.startTransaction) {
            this.state = State.transactionPending;
        }
        else {
            this.state = State.connection;
        }
    }
    Object.defineProperty(Connection.prototype, "inTransaction", {
        // PUBLIC ACCESSORS
        // --------------------------------------------------------------------------------------------
        get: function () {
            return (this.state === State.transaction || this.state === State.transactionPending);
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Connection.prototype, "isActive", {
        get: function () {
            return (this.state !== State.released);
        },
        enumerable: true,
        configurable: true
    });
    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    Connection.prototype.startTransaction = function (lazy) {
        var _this = this;
        if (lazy === void 0) { lazy = true; }
        if (this.isActive === false)
            return Promise.reject(new errors_1.PgError('Cannot start transaction: connection is not currently active'));
        if (this.inTransaction)
            return Promise.reject(new errors_1.PgError('Cannot start transaction: connection is already in transaction'));
        if (lazy) {
            this.state = State.transactionPending;
            return Promise.resolve();
        }
        else {
            return this.execute(BEGIN_TRANSACTION).then(function () {
                _this.state = State.transaction;
            });
        }
    };
    Connection.prototype.release = function (action) {
        var _this = this;
        if (this.state === State.released)
            return Promise.reject(new errors_1.PgError('Cannot release connection: connection has already been released'));
        switch (action) {
            case 'commit':
                return this.execute(COMMIT_TRANSACTION)
                    .then(function () { return _this.releaseConnection(); });
            case 'rollback':
                return this.rollbackAndRelease();
            default:
                if (this.inTransaction) {
                    return this.rollbackAndRelease(new errors_1.PgError('Uncommitted transaction detected during connection release'));
                }
                else {
                    this.releaseConnection();
                    return Promise.resolve();
                }
        }
    };
    Connection.prototype.execute = function (queryOrQueries) {
        var _this = this;
        if (this.isActive === false)
            return Promise.reject(new errors_1.PgError('Cannot execute queries: connection has been released'));
        var _a = this.buildQueryList(queryOrQueries), queries = _a.queries, state = _a.state;
        return Promise.resolve()
            .then(function () { return _this.buildDbQueries(queries); })
            .then(function (dbQueries) { return dbQueries.map(function (query) { return _this.executeQuery(query); }); })
            .then(function (queryResults) { return Promise.all(queryResults); })
            .then(function (results) {
            var flatResults = results.reduce(function (agg, result) { return agg.concat(result); }, []);
            if (queries.length !== flatResults.length)
                throw new errors_1.PgError("Cannot process query results: expected (" + queries.length + ") results but recieved (" + results.length + ")");
            var collector = new Collector_1.default(queries);
            queries.forEach(function (query, i) {
                var result = flatResults[i];
                var processedResult = _this.processQueryResult(query, result);
                collector.addResult(query, processedResult);
            });
            _this.state = state;
            return collector.getResults();
        })
            .catch(function (reason) {
            if (reason instanceof errors_1.PgError === false) {
                reason = new errors_1.PgError(reason.message);
            }
            return _this.rollbackAndRelease(reason);
        });
    };
    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    Connection.prototype.processQueryResult = function (query, result) {
        var processedResult;
        if (query.handler && typeof query.handler.parse === 'function') {
            processedResult = [];
            for (var i = 0; i < result.rows.length; i++) {
                processedResult.push(query.handler.parse(result.rows[i]));
            }
        }
        else {
            processedResult = result.rows;
        }
        return processedResult;
    };
    Connection.prototype.rollbackAndRelease = function (reason) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.client.query(ROLLBACK_TRANSACTION.text, function (error, results) {
                if (error) {
                    _this.releaseConnection(error);
                    reason ? reject(reason) : reject(error);
                }
                else {
                    if (reason) {
                        _this.releaseConnection();
                        reject(reason);
                    }
                    else {
                        _this.state = State.connection;
                        _this.releaseConnection();
                        resolve();
                    }
                }
            });
        });
    };
    Connection.prototype.releaseConnection = function (error) {
        this.state = State.released;
        this.done(error);
    };
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    Connection.prototype.buildQueryList = function (queryOrQueries) {
        if (Array.isArray(queryOrQueries)) {
            var queries = queryOrQueries;
        }
        else {
            var queries = (queryOrQueries ? [queryOrQueries] : []);
        }
        var state = this.state;
        if (this.state === State.transactionPending && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            state = State.transaction;
        }
        return { queries: queries, state: state };
    };
    Connection.prototype.buildDbQueries = function (queries) {
        var dbQueries = [];
        var previousQuery;
        for (var i = 0; i < queries.length; i++) {
            var dbQuery = Query_1.toDbQuery(queries[i]);
            if (this.options.collapseQueries && previousQuery && !Query_1.isParametrized(dbQuery) && !Query_1.isParametrized(previousQuery)) {
                previousQuery.text += dbQuery.text;
                previousQuery.multiResult = true;
            }
            else {
                dbQueries.push(dbQuery);
                previousQuery = dbQuery;
            }
        }
        return dbQueries;
    };
    Connection.prototype.executeQuery = function (query) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.client.query(query, function (error, results) {
                error ? reject(error) : resolve(results);
            });
        });
    };
    return Connection;
})();
exports.Connection = Connection;
// COMMON QUERIES
// ================================================================================================
var BEGIN_TRANSACTION = {
    text: 'BEGIN;'
};
var COMMIT_TRANSACTION = {
    text: 'COMMIT;'
};
var ROLLBACK_TRANSACTION = {
    text: 'ROLLBACK;'
};
//# sourceMappingURL=Connection.js.map