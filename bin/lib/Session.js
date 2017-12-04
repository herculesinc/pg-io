"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Query_1 = require("./Query");
const errors_1 = require("./errors");
const util_1 = require("./util");
// SESSION CLASS DEFINITION
// ================================================================================================
class Session {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(dbName, client, options, logger) {
        if (!client)
            throw new errors_1.ConnectionError('Cannot create a connection session: client is undefined');
        this.dbName = dbName;
        this.client = client;
        this.readonly = !!options.readonly;
        this.state = 1 /* pending */;
        this.batch = [];
        this.logger = logger;
    }
    // PUBLIC ACCESSORS
    // --------------------------------------------------------------------------------------------
    get isActive() {
        return (this.state <= 2 /* active */);
    }
    get inTransaction() {
        return (this.state === 2 /* active */);
    }
    get isReadOnly() {
        return this.readonly;
    }
    // LIFECYCLE METHODS
    // --------------------------------------------------------------------------------------------
    close(action) {
        if (!this.isActive) {
            return Promise.reject(new errors_1.ConnectionError('Cannot close session: session has already been closed'));
        }
        switch (action) {
            case 'rollback': {
                return this.rollbackAndRelease();
            }
            default: {
                this.logger && this.logger.debug('Closing the session', this.dbName);
                if (this.inTransaction) {
                    const commitPromise = this.execute(COMMIT_TRANSACTION).then(() => this.releaseClient());
                    this.state = 3 /* closing */;
                    return commitPromise;
                }
                else {
                    return Promise.resolve(this.releaseClient());
                }
            }
        }
    }
    execute(query) {
        if (this.isActive === false) {
            return Promise.reject(new errors_1.ConnectionError('Cannot execute a query: the session is closed'));
        }
        const pgQuery = Query_1.toPgQuery(query);
        if (this.state === 1 /* pending */) {
            const beginQuery = this.readonly ? BEGIN_RO_TRANSACTION : BEGIN_RW_TRANSACTION;
            // TODO: append this to the beginning of the query batch
        }
        const resultPromise = new Promise(function (resolve, reject) {
            // TODO: refactro to handle multiple sources
            pgQuery.source = [{
                    query: query,
                    resolve: resolve,
                    reject: reject
                }];
        });
        this.batch.push(pgQuery);
        process.nextTick(() => {
            const start = process.hrtime();
            const batch = this.batch;
            this.batch = [];
            this.logger && this.logger.debug(`Executing ${batch.length} queries: [...]`, this.dbName);
            for (let query of batch) {
                this.client.query(query, (error, results) => {
                    if (error) {
                        // TODO: release the client on error
                        for (let source of query.source)
                            source.reject(error);
                        return;
                    }
                    for (let source of query.source) {
                        const rows = this.processQueryResult(source.query, results);
                        if (source.query.mask === 'list') {
                            source.resolve(rows);
                        }
                        else if (source.query.mask === 'single') {
                            source.resolve(rows[0]);
                        }
                        else {
                            source.resolve(undefined);
                        }
                    }
                    // TODO: log only the last query in the batch
                    this.logger && this.logger.trace(this.dbName, 'query', util_1.since(start), true);
                });
            }
        });
        return resultPromise;
    }
    // PROTECTED METHODS
    // --------------------------------------------------------------------------------------------
    processQueryResult(query, result) {
        let processedResult;
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
        this.logger && this.logger.debug('Rolling back transaction and closing the session', this.dbName);
        const rollbackPromise = new Promise((resolve, reject) => {
            this.client.query(ROLLBACK_TRANSACTION.text, (error, results) => {
                if (error) {
                    error = new errors_1.QueryError(error);
                    this.releaseClient(error);
                    reason ? reject(reason) : reject(error);
                }
                else {
                    if (reason) {
                        this.releaseClient();
                        reject(reason);
                    }
                    else {
                        this.releaseClient();
                        resolve();
                    }
                }
            });
        });
        this.state = 3 /* closing */;
        return rollbackPromise;
    }
    releaseClient(error) {
        this.state = 4 /* closed */;
        if (this.client) {
            this.client.release(error);
            this.client = undefined;
            this.logger && this.logger.debug('Session closed', this.dbName);
        }
        else {
            this.logger && this.logger.warn('Overlapping client release detected', this.dbName);
        }
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    executeQuery(query) {
        return new Promise((resolve, reject) => {
            this.client.query(query, (error, results) => {
                console.log(query.text);
                error ? reject(new errors_1.QueryError(error)) : resolve(results);
            });
        });
    }
}
exports.Session = Session;
// COMMON QUERIES
// ================================================================================================
const BEGIN_RO_TRANSACTION = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ ONLY;'
};
const BEGIN_RW_TRANSACTION = {
    name: 'qBeginTransaction',
    text: 'BEGIN READ WRITE;'
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