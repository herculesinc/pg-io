'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _Query = require('./Query');

var _Collector = require('./Collector');

var _Collector2 = _interopRequireDefault(_Collector);

var _errors = require('./errors');

// CONNECTION CLASS DEFINITION
// ================================================================================================

class Connection {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(options, client, done) {
        this.options = options;
        this.client = client;
        this.done = done;
        if (options.startTransaction) {
            this.state = 3;
        } else /* transactionPending */{
                this.state = 1;
            }
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    /* connection */get inTransaction() {
        return this.state === 2 /* transaction */ || this.state === 3 /* transactionPending */;
    }
    get isActive() {
        return this.state !== 4 /* released */;
    }
    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    startTransaction() {
        let lazy = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

        if (this.isActive === false) return Promise.reject(new _errors.ConnectionError('Cannot start transaction: connection is not currently active'));
        if (this.inTransaction) return Promise.reject(new _errors.TransactionError('Cannot start transaction: connection is already in transaction'));
        if (lazy) {
            this.state = 3;
            /* transactionPending */return Promise.resolve();
        } else {
            return this.execute(BEGIN_TRANSACTION).then(() => {
                this.state = 2;
            });
        }
    }
    /* transaction */release(action) {
        if (this.state === 4 /* released */) return Promise.reject(new _errors.ConnectionError('Cannot release connection: connection has already been released'));
        switch (action) {
            case 'commit':
                return this.execute(COMMIT_TRANSACTION).then(() => this.releaseConnection());
            case 'rollback':
                return this.rollbackAndRelease();
            default:
                if (this.inTransaction) {
                    return this.rollbackAndRelease(new _errors.TransactionError('Uncommitted transaction detected during connection release'));
                } else {
                    this.releaseConnection();
                    return Promise.resolve();
                }
        }
    }
    execute(queryOrQueries) {
        if (this.isActive === false) return Promise.reject(new _errors.ConnectionError('Cannot execute queries: connection has been released'));

        var _buildQueryList = this.buildQueryList(queryOrQueries);

        var queries = _buildQueryList.queries;
        var state = _buildQueryList.state;

        return Promise.resolve().then(() => this.buildDbQueries(queries)).then(dbQueries => dbQueries.map(query => this.executeQuery(query))).then(queryResults => Promise.all(queryResults)).then(results => {
            try {
                var flatResults = results.reduce((agg, result) => agg.concat(result), []);
                if (queries.length !== flatResults.length) throw new _errors.ParseError(`Cannot parse query results: expected (${ queries.length }) results but recieved (${ results.length })`);
                var collector = new _Collector2.default(queries);
                queries.forEach((query, i) => {
                    collector.addResult(query, this.processQueryResult(query, flatResults[i]));
                });
                this.state = state;
                return collector.getResults();
            } catch (error) {
                if (error instanceof _errors.PgError === false) error = new _errors.ParseError(error);
                throw error;
            }
        }).catch(reason => {
            return this.rollbackAndRelease(reason);
        });
    }
    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    processQueryResult(query, result) {
        var processedResult;
        if (query.handler && typeof query.handler.parse === 'function') {
            processedResult = [];
            for (var i = 0; i < result.rows.length; i++) {
                processedResult.push(query.handler.parse(result.rows[i]));
            }
        } else {
            processedResult = result.rows;
        }
        return processedResult;
    }
    rollbackAndRelease(reason) {
        return new Promise((resolve, reject) => {
            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
                    error = new _errors.QueryError(error);
                    this.releaseConnection(error);
                    reason ? reject(reason) : reject(error);
                } else {
                    if (reason) {
                        this.releaseConnection();
                        reject(reason);
                    } else {
                        this.state = 1;
                        /* connection */this.releaseConnection();
                        resolve();
                    }
                }
            });
        });
    }
    releaseConnection(error) {
        this.state = 4;
        /* released */this.done(error);
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    buildQueryList(queryOrQueries) {
        if (Array.isArray(queryOrQueries)) {
            var queries = queryOrQueries;
        } else {
            var queries = queryOrQueries ? [queryOrQueries] : [];
        }
        var state = this.state;
        if (this.state === 3 /* transactionPending */ && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            state = 2;
        }
        /* transaction */return { queries, state };
    }
    buildDbQueries(queries) {
        var dbQueries = [];
        var previousQuery;
        for (var i = 0; i < queries.length; i++) {
            var dbQuery = (0, _Query.toDbQuery)(queries[i]);
            if (this.options.collapseQueries && previousQuery && !(0, _Query.isParametrized)(dbQuery) && !(0, _Query.isParametrized)(previousQuery)) {
                previousQuery.text += dbQuery.text;
                previousQuery.multiResult = true;
            } else {
                dbQueries.push(dbQuery);
                previousQuery = dbQuery;
            }
        }
        return dbQueries;
    }
    executeQuery(query) {
        return new Promise((resolve, reject) => {
            this.client.query(query, (error, results) => {
                error ? reject(new _errors.QueryError(error)) : resolve(results);
            });
        });
    }
}

// COMMON QUERIES
// ================================================================================================
exports.Connection = Connection;
var BEGIN_TRANSACTION = {
    text: 'BEGIN;'
};
var COMMIT_TRANSACTION = {
    text: 'COMMIT;'
};
var ROLLBACK_TRANSACTION = {
    text: 'ROLLBACK;'
};
//# sourceMappingURL=../../bin/lib/Connection.js.map