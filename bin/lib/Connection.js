'use strict';

var index_1 = require('./../index');
var Query_1 = require('./Query');
var Collector_1 = require('./Collector');
var errors_1 = require('./errors');
var util_1 = require('./util');
// CONNECTION CLASS DEFINITION
// ================================================================================================
class Connection {
    // CONSTRUCTOR AND INJECTOR
    // --------------------------------------------------------------------------------------------
    constructor(database, options) {
        this.database = database;
        this.options = options;
        this.log = index_1.config.logger ? index_1.config.logger.log : undefined;
        if (options.startTransaction) {
            this.log && this.log(`Starting database transaction in lazy mode`);
            this.state = 3;
        } else /* transactionPending */{
                this.state = 1;
            }
    }
    /* connection */inject(client, done) {
        this.client = client;
        this.done = done;
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get inTransaction() {
        return this.state === 2 /* transaction */ || this.state === 3 /* transactionPending */;
    }
    get isActive() {
        return this.state !== 4 /* released */;
    }
    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    startTransaction() {
        let lazy = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

        if (this.isActive === false) return Promise.reject(new errors_1.ConnectionError('Cannot start transaction: connection is not currently active'));
        if (this.inTransaction) return Promise.reject(new errors_1.TransactionError('Cannot start transaction: connection is already in transaction'));
        this.log && this.log(`Starting database transaction in ${ lazy ? 'lazy' : 'eager' } mode`);
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
        if (this.state === 4 /* released */) return Promise.reject(new errors_1.ConnectionError('Cannot release connection: connection has already been released'));
        var start = process.hrtime();
        switch (action) {
            case 'commit':
                this.log && this.log('Committing transaction and releasing connection back to the pool');
                return this.execute(COMMIT_TRANSACTION).then(() => {
                    this.releaseConnection();
                    this.log && this.log(`Transaction committed in ${ util_1.since(start) } ms; pool state: ${ this.database.getPoolDescription() }`);
                });
            case 'rollback':
                this.log && this.log('Rolling back transaction and releasing connection back to the pool');
                return this.rollbackAndRelease().then(result => {
                    this.log && this.log(`Transaction rolled back in ${ util_1.since(start) } ms; pool state: ${ this.database.getPoolDescription() }`);
                    return result;
                });
            default:
                this.log && this.log('Releasing connection back to the pool');
                if (this.inTransaction) {
                    return this.rollbackAndRelease(new errors_1.TransactionError('Uncommitted transaction detected during connection release'));
                } else {
                    this.releaseConnection();
                    this.log && this.log(`Connection released in ${ util_1.since(start) } ms; pool state: ${ this.database.getPoolDescription() }`);
                    return Promise.resolve();
                }
        }
    }
    execute(queryOrQueries) {
        if (this.isActive === false) return Promise.reject(new errors_1.ConnectionError('Cannot execute queries: connection has been released'));
        var start = process.hrtime();

        var _buildQueryList = this.buildQueryList(queryOrQueries);

        var queries = _buildQueryList.queries;
        var state = _buildQueryList.state;

        this.log && this.log(`Executing ${ queries.length } queries: [${ buildQueryNameList(queries).join(', ') }];`);
        return Promise.resolve().then(() => this.buildDbQueries(queries)).then(dbQueries => dbQueries.map(query => this.executeQuery(query))).then(queryResults => Promise.all(queryResults)).then(results => {
            try {
                this.log && this.log(`Queries executed in ${ util_1.since(start) } ms; processing results`);
                start = process.hrtime();
                var flatResults = results.reduce((agg, result) => agg.concat(result), []);
                if (queries.length !== flatResults.length) throw new errors_1.ParseError(`Cannot parse query results: expected (${ queries.length }) results but recieved (${ results.length })`);
                var collector = new Collector_1.Collector(queries);
                queries.forEach((query, i) => {
                    collector.addResult(query, this.processQueryResult(query, flatResults[i]));
                });
                this.state = state;
                this.log && this.log(`Query results processed in ${ util_1.since(start) } ms`);
                return collector.getResults();
            } catch (error) {
                if (error instanceof errors_1.PgError === false) error = new errors_1.ParseError(error);
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
                    error = new errors_1.QueryError(error);
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
            var dbQuery = Query_1.toDbQuery(queries[i]);
            if (this.options.collapseQueries && previousQuery && !Query_1.isParametrized(dbQuery) && !Query_1.isParametrized(previousQuery)) {
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
                error ? reject(new errors_1.QueryError(error)) : resolve(results);
            });
        });
    }
}
exports.Connection = Connection;
// COMMON QUERIES
// ================================================================================================
var BEGIN_TRANSACTION = {
    name: 'qBeginTransaction',
    text: 'BEGIN;'
};
var COMMIT_TRANSACTION = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};
var ROLLBACK_TRANSACTION = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};
// HELPER FUNCTIONS
// ================================================================================================
function buildQueryNameList(queryList) {
    return queryList.map(query => {
        return query.name ? query.name : 'unnamed';
    });
}
//# sourceMappingURL=../../bin/lib/Connection.js.map