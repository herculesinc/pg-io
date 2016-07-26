"use strict";
const Query_1 = require('./Query');
const Collector_1 = require('./Collector');
const errors_1 = require('./errors');
const util_1 = require('./util');
// SESSION CLASS DEFINITION
// ================================================================================================
class Session {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(client, options, logger) {
        if (!client)
            throw new errors_1.ConnectionError('Cannot create a connection session: client is undefined');
        this.client = client;
        this.options = options;
        this.logger = logger;
        if (this.options.startTransaction) {
            this.logger && this.logger.debug(`Starting database transaction in lazy mode`);
            this.transaction = 1 /* pending */;
        }
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get inTransaction() {
        return (this.transaction > 0);
    }
    get isActive() {
        return (this.client != undefined);
    }
    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    startTransaction(lazy = true) {
        if (this.isActive === false) {
            return Promise.reject(new errors_1.ConnectionError('Cannot start transaction: session is not currently active'));
        }
        if (this.inTransaction) {
            return Promise.reject(new errors_1.TransactionError('Cannot start transaction: session is already in transaction'));
        }
        this.logger && this.logger.debug(`Starting database transaction in ${lazy ? 'lazy' : 'eager'} mode`);
        if (lazy) {
            this.transaction = 1 /* pending */;
            return Promise.resolve();
        }
        else {
            return this.execute(BEGIN_TRANSACTION).then(() => {
                this.transaction = 2 /* active */;
            });
        }
    }
    release(action) {
        if (!this.isActive) {
            return Promise.reject(new errors_1.ConnectionError('Cannot release session: session has already been released'));
        }
        switch (action) {
            case 'commit':
                this.logger && this.logger.debug('Committing transaction and releasing session back to the pool');
                return this.execute(COMMIT_TRANSACTION)
                    .then(() => this.closeSession());
            case 'rollback':
                this.logger && this.logger.debug('Rolling back transaction and releasing session back to the pool');
                return this.rollbackAndRelease();
            default:
                this.logger && this.logger.debug('Releasing session back to the pool');
                if (this.inTransaction) {
                    return this.rollbackAndRelease(new errors_1.TransactionError('Uncommitted transaction detected during session release'));
                }
                else {
                    this.closeSession();
                    return Promise.resolve();
                }
        }
    }
    execute(queryOrQueries) {
        if (this.isActive === false) {
            return Promise.reject(new errors_1.ConnectionError('Cannot execute queries: session has been released'));
        }
        var start = process.hrtime();
        const { queries, command, transaction } = this.buildQueryList(queryOrQueries);
        this.logger && this.logger.debug(`Executing ${queries.length} queries: [${command}]`);
        return Promise.resolve()
            .then(() => this.buildDbQueries(queries))
            .then((dbQueries) => dbQueries.map((query) => this.executeQuery(query)))
            .then((queryResults) => Promise.all(queryResults))
            .then((results) => {
            try {
                let duration = util_1.since(start);
                this.logger && this.logger.trace('database', command, duration); // TODO: get database name
                start = process.hrtime();
                const flatResults = results.reduce((agg, result) => agg.concat(result), []);
                if (queries.length !== flatResults.length) {
                    throw new errors_1.ParseError(`Cannot parse query results: expected (${queries.length}) results but recieved (${results.length})`);
                }
                const collector = new Collector_1.Collector(queries);
                for (let i = 0; i < queries.length; i++) {
                    let query = queries[i];
                    collector.addResult(query, this.processQueryResult(query, flatResults[i]));
                }
                this.transaction = transaction;
                duration = util_1.since(start);
                this.logger && this.logger.debug(`Query results processed in ${duration} ms`);
                return collector.getResults();
            }
            catch (error) {
                if (error instanceof errors_1.PgError === false)
                    error = new errors_1.ParseError(error);
                throw error;
            }
        })
            .catch((reason) => {
            return this.rollbackAndRelease(reason);
        });
    }
    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    processQueryResult(query, result) {
        var processedResult;
        if (query.handler && typeof query.handler.parse === 'function') {
            processedResult = [];
            for (let row of result.rows) {
                processedResult.push(query.handler.parse(row));
            }
        }
        else {
            processedResult = result.rows;
        }
        return processedResult;
    }
    rollbackAndRelease(reason) {
        return new Promise((resolve, reject) => {
            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
                    error = new errors_1.QueryError(error);
                    this.closeSession(error);
                    reason ? reject(reason) : reject(error);
                }
                else {
                    if (reason) {
                        this.closeSession();
                        reject(reason);
                    }
                    else {
                        this.closeSession();
                        resolve();
                    }
                }
            });
        });
    }
    closeSession(error) {
        this.transaction = undefined;
        this.client.release(error);
        this.client = undefined;
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    buildQueryList(queryOrQueries) {
        let queries = queryOrQueries
            ? (Array.isArray(queryOrQueries) ? queryOrQueries : [queryOrQueries])
            : [];
        // if transaction is pending
        let transaction = this.transaction;
        if (transaction === 1 /* pending */ && queries.length > 0) {
            queries.unshift(BEGIN_TRANSACTION);
            transaction = 2 /* active */;
        }
        if (queries.length === 2 && queries[0] === BEGIN_TRANSACTION) {
            if (queries[1] === COMMIT_TRANSACTION || queries[1] === ROLLBACK_TRANSACTION) {
                queries = [];
            }
        }
        let qNames = [];
        for (let query of queries) {
            qNames.push(query.name ? query.name : 'unnamed');
        }
        const command = qNames.join(', ');
        return { queries, command, transaction };
    }
    buildDbQueries(queries) {
        const dbQueries = [];
        var previousQuery;
        for (let query of queries) {
            let dbQuery = Query_1.toDbQuery(query);
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
    }
    executeQuery(query) {
        return new Promise((resolve, reject) => {
            this.client.query(query, (error, results) => {
                error ? reject(new errors_1.QueryError(error)) : resolve(results);
            });
        });
    }
}
exports.Session = Session;
// COMMON QUERIES
// ================================================================================================
const BEGIN_TRANSACTION = {
    name: 'qBeginTransaction',
    text: 'BEGIN;'
};
const COMMIT_TRANSACTION = {
    name: 'qCommitTransaction',
    text: 'COMMIT;'
};
const ROLLBACK_TRANSACTION = {
    name: 'qRollbackTransaction',
    text: 'ROLLBACK;'
};
//# sourceMappingURL=Session.js.map