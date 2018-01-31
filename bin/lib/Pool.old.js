"use strict";
// IMPORTS
// ================================================================================================
const events = require('events');
const pg_1 = require('pg');
const errors_1 = require('./errors');
// CLASS DEFINITION
// ================================================================================================
class ConnectionPool extends events.EventEmitter {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(poolOptions, connectionOptions) {
        super();
        this.state = 2 /* active */;
        this.pOptions = poolOptions;
        this.cOptions = connectionOptions;
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
    initialize() {
        if (this.state !== 1 /* pending */) {
            const error = new Error('Cannot initialize connection pool: the pool has already been initialized');
            return Promise.reject(error);
        }
        this.state = 2 /* active */;
        return Promise.resolve();
    }
    shutdown() {
        if (!this.isActive) {
            const error = new Error('Cannot shut down connection pool: the pool is not active');
            return Promise.reject(error);
        }
        this.state = 3 /* closing */;
        const shutdownPromise = new Promise((resolve, reject) => {
            this.shutdownRequest = new ShutdownRequest(resolve, reject);
        });
        // clear idle clients
        for (let client of this.idle.keys()) {
            this.removeClient(client);
        }
        // if there are no clients left, shutdown is complete
        if (this.clients.size === 0) {
            this.shutdownRequest.complete();
            this.shutdownRequest = undefined;
        }
        return shutdownPromise;
    }
    acquire() {
        if (!this.isActive) {
            const error = new Error('Cannot acquire a connection from the pool: the pool is not active');
            return Promise.reject(error);
        }
        // create a connection request
        let request;
        const clientPromise = new Promise((resolve, reject) => {
            request = new ConnectionRequest(resolve, reject);
        });
        // if there are idle clients, fullfil the request immediately
        if (this.idle.size > 0) {
            const [client, timeoutId] = this.idle.entries().next().value;
            clearTimeout(timeoutId);
            request.fulfill(client, this);
            return clientPromise;
        }
        // if there are no idle clients available, set a timeout for fulfilling the request
        request.setTimeout(this.pOptions.connectionTimeout);
        // if the pool is exhausted, queue the request and return
        if (this.clients.size >= this.pOptions.maxSize) {
            this.requests.push(request);
            return clientPromise;
        }
        const client = new pg_1.Client(this.cOptions);
        this.clients.add(client);
        client.connect((error) => {
            // TODO: handle shutdown process
            if (error) {
                this.clients.delete(client);
                request.reject(error);
            }
            else {
                const errorHandler = (error) => {
                    client.removeListener('error', errorHandler);
                    client.on('error', () => {
                        //this.log('additional client error after disconnection due to error', err)
                    });
                    this.removeClient(client);
                    this.emit('error', error, client);
                };
                client.on('error', errorHandler);
                if (request.isPending) {
                    request.fulfill(client, this);
                }
                else {
                    // the request is no longer relevant, add client to idle map
                    this.addToIdle(client);
                }
            }
        });
        return clientPromise;
    }
    // PRIVATE METHODS
    // --------------------------------------------------------------------------------------------
    addToIdle(client) {
        const idleTimeoutId = setTimeout(() => {
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
        client.end();
    }
}
exports.ConnectionPool = ConnectionPool;
// HELPER CLASSES
// ================================================================================================
class ConnectionRequest {
    constructor(resolver, rejector) {
        this.resolver = resolver;
        this.rejector = rejector;
    }
    get isPending() {
        return (this.resolver !== undefined);
    }
    setTimeout(ms) {
        if (this.timeoutId) {
            throw new Error('Cannot set connection request timeout: the timeout is already set');
        }
        this.timeoutId = setTimeout(() => {
            if (this.isPending) {
                const error = new errors_1.ConnectionError('Connection request has timed out');
                process.nextTick(this.rejector, error);
                this.resolver = undefined;
                this.rejector = undefined;
            }
        }, ms);
    }
    fulfill(client, pool) {
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
        client.release = releaseHandler.bind(pool, client);
        process.nextTick(this.resolver, client);
        this.resolver = undefined;
        this.rejector = undefined;
    }
    reject(reason) {
        if (this.isPending) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = undefined;
            }
            process.nextTick(this.rejector, reason);
            this.resolver = undefined;
            this.rejector = undefined;
        }
    }
}
class ShutdownRequest {
    constructor(resolver, rejector) {
        this.resolver = resolver;
        this.rejector = rejector;
    }
    complete() {
        process.nextTick(this.resolver);
    }
}
// HELPER FUNCTIONS
// ================================================================================================
function releaseHandler(client, error) {
    client.release = undefined;
    if (error) {
    }
    // get next pending request
    let request;
    while (this.requests.length > 0) {
        request = this.requests.shift();
        if (request.isPending)
            break;
    }
    // if a pending request was found, fulfill it with the client immediately
    if (request && request.isPending) {
        request.fulfill(client, this);
    }
    else {
        // otherwise, add the client to the set of idle clients
        this.addToIdle(client);
    }
}
//# sourceMappingURL=Pool.old.js.map