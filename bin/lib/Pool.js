"use strict";
// IMPORTS
// ================================================================================================
const events = require('events');
const pg_1 = require('pg');
const defaults_1 = require('./defaults');
const errors_1 = require('./errors');
// MODULE VARIABLES
// ================================================================================================
exports.ERROR_EVENT = 'error';
exports.CREATED_EVENT = 'connection created';
exports.CLOSED_EVENT = 'connection closed';
// CLASS DEFINITION
// ================================================================================================
class ConnectionPool extends events.EventEmitter {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(poolOptions, connectionOptions, logger) {
        super();
        this.state = 2 /* active */;
        this.pOptions = validatePoolOptions(poolOptions);
        this.cOptions = connectionOptions;
        this.logger = logger;
        this.requests = [];
        this.clients = new Set();
        this.idle = new Map();
    }
    // PUBLIC PROPERTIES
    // --------------------------------------------------------------------------------------------
    get totalCount() {
        return this.clients.size;
    }
    get idleCount() {
        return this.idle.size;
    }
    get isFull() {
        return (this.clients.size >= this.pOptions.maxSize);
    }
    get isActive() {
        return (this.state === 2 /* active */);
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    shutdown(callback) {
        if (!this.isActive) {
            const error = new Error('Cannot shut down connection pool: the pool is not active');
            callback(error);
            return;
        }
        // if the pool is empty, mark the pool as closed and return
        if (!this.totalCount) {
            this.state = 4 /* closed */;
            callback();
            return;
        }
        // otherwise, prepare for closing clients
        this.state = 3 /* closing */;
        this.shutdownCallback = callback;
        // clear pending requests
        for (let request of this.requests) {
            const error = new errors_1.ConnectionError('Connection pool is shutting down');
            request.reject(error);
        }
        // clear idle clients
        for (let client of this.idle.keys()) {
            this.removeClient(client);
        }
    }
    acquire(callback) {
        if (!this.isActive) {
            const error = new Error('Cannot acquire a connection from the pool: the pool is not active');
            callback(error);
            return;
        }
        // create a connection request
        const request = new ConnectionRequest(callback);
        // if there are idle clients, fullfil the request immediately
        if (this.idle.size > 0) {
            const [client, timeoutId] = this.idle.entries().next().value;
            clearTimeout(timeoutId);
            this.idle.delete(client);
            request.fulfill(client, this.releaseClient.bind(this, client));
            return;
        }
        // if there are no idle clients available, set a timeout for fulfilling the request
        request.setTimeout(this.pOptions.connectionTimeout);
        // if the pool is exhausted, queue the request and return
        if (this.clients.size >= this.pOptions.maxSize) {
            this.requests.push(request);
            return;
        }
        const start = process.hrtime();
        this.logger.debug('creating new connection');
        const client = new pg_1.Client(this.cOptions);
        this.clients.add(client);
        client.connect((error) => {
            this.logger.trace('create connection', start, !error);
            if (error) {
                this.removeClient(client);
                request.reject(error);
                return;
            }
            this.emit(exports.CREATED_EVENT, client);
            if (this.state === 3 /* closing */) {
                // if the pool is shutting down, the request should already be rejected
                if (request.isPending)
                    throw new Error('Pending request detected during shutdown');
                this.removeClient(client);
            }
            else {
                client.once('error', (error) => {
                    client.on('error', (error) => {
                        this.logger.debug('Client error after disconnect: ' + error.message);
                    });
                    this.removeClient(client);
                    this.emit(exports.ERROR_EVENT, error, client);
                });
                if (request.isPending) {
                    request.fulfill(client, this.releaseClient.bind(this, client));
                }
                else {
                    this.addToIdle(client);
                }
            }
        });
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    addToIdle(client) {
        if (!this.clients.has(client)) {
            throw new Error('Cannot add client to idle set: the client is missing from client set');
        }
        const idleTimeoutId = setTimeout(() => {
            this.logger.debug('Closing idle connection due to timeout');
            this.removeClient(client);
        }, this.pOptions.idleTimeout);
        this.idle.set(client, idleTimeoutId);
    }
    removeClient(client) {
        // if the client is idle, clear the timeout and remove it from the idle map
        const idleTimeout = this.idle.get(client);
        if (idleTimeout) {
            clearTimeout(idleTimeout);
            this.idle.delete(client);
        }
        // remove the client from the set of clients
        this.clients.delete(client);
        // disconnect the client
        client.end((error) => {
            this.logger.debug('Connection closed' + (error ? ' with error: ' + error.message : ''));
            this.emit(exports.CLOSED_EVENT, client);
        });
        // check if the pool should be shut down
        if (this.state === 3 /* closing */ && this.clients.size === 0) {
            this.state = 4 /* closed */;
            this.shutdownCallback();
            this.shutdownCallback = undefined;
        }
    }
    releaseClient(client, error) {
        client.release = undefined;
        if (error || this.state === 3 /* closing */) {
            this.removeClient(client);
            return;
        }
        // find next pending request
        let request;
        while (this.requests.length > 0) {
            request = this.requests.shift();
            if (request.isPending)
                break;
        }
        // if a pending request was found, fulfill it immediately
        if (request && request.isPending) {
            request.fulfill(client, this.releaseClient.bind(this, client));
        }
        else {
            // otherwise, add the client to idle set
            this.addToIdle(client);
        }
    }
}
exports.ConnectionPool = ConnectionPool;
// HELPER CLASSES
// ================================================================================================
class ConnectionRequest {
    constructor(callback) {
        this.callback = callback;
    }
    get isPending() {
        return (this.callback !== undefined);
    }
    setTimeout(ms) {
        if (this.timeoutId) {
            throw new Error('Cannot set connection request timeout: the timeout is already set');
        }
        this.timeoutId = setTimeout(() => {
            if (this.isPending) {
                const error = new errors_1.ConnectionError('Connection request has timed out');
                process.nextTick(this.callback, error);
                this.callback = undefined;
            }
        }, ms);
    }
    fulfill(client, releaseHandler) {
        if (!this.isPending) {
            throw new Error('Cannot fulfill connection request: the request is not pending');
        }
        if (client.release !== undefined) {
            throw new Error('Cannot fulfill connection request: the client is not free');
        }
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
        client.release = releaseHandler;
        process.nextTick(this.callback, undefined, client);
        this.callback = undefined;
    }
    reject(reason) {
        if (this.isPending) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
            process.nextTick(this.callback, reason);
            this.callback = undefined;
        }
    }
}
// HELPER FUNCTIONS
// ================================================================================================
function validatePoolOptions(options) {
    options = Object.assign({}, defaults_1.defaults.pool, options);
    if (typeof options.maxSize !== 'number')
        throw new TypeError('Pool options are invalid');
    if (options.maxSize <= 0)
        throw new TypeError('Pool options are invalid');
    if (!Number.isInteger(options.maxSize))
        throw new TypeError('Pool options are invalid');
    if (typeof options.idleTimeout !== 'number')
        throw new TypeError('Pool options are invalid');
    if (options.idleTimeout <= 0)
        throw new TypeError('Pool options are invalid');
    if (!Number.isInteger(options.idleTimeout))
        throw new TypeError('Pool options are invalid');
    if (typeof options.connectionTimeout !== 'number')
        throw new TypeError('Pool options are invalid');
    if (options.connectionTimeout <= 0)
        throw new TypeError('Pool options are invalid');
    if (!Number.isInteger(options.connectionTimeout))
        throw new TypeError('Pool options are invalid');
    return options;
}
//# sourceMappingURL=Pool.js.map