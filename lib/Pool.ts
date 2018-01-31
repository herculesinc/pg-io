// IMPORTS
// ================================================================================================
import * as events from 'events';
import { ConnectionConfig, Client } from 'pg';
import { ConnectionError } from './errors';
import { DbLogger } from './util';

// MODULE VARIABLES
// ================================================================================================
export const ERROR_EVENT   = 'error';
export const CREATED_EVENT = 'connection created';
export const CLOSED_EVENT  = 'connection closed';

// INTERFACES
// ================================================================================================
export interface PoolOptions {
    maxSize?           : number;
    idleTimeout?       : number;
    connectionTimeout? : number;
}

const enum PoolState {
    active = 2, closing = 3, closed = 4
}

type ConnectionCallback = (error: Error, client?: Client) => void;
type ShutdownCallback = (error?: Error) => void;

// CLASS DEFINITION
// ================================================================================================
export class ConnectionPool extends events.EventEmitter {

    private state               : PoolState;
    private readonly pOptions   : PoolOptions;
    private readonly cOptions   : ConnectionConfig;
    private readonly logger     : DbLogger;

    private readonly requests   : ConnectionRequest[];
    private readonly clients    : Set<Client>;
    private readonly idle       : Map<Client, NodeJS.Timer>;

    private shutdownCallback?   : ShutdownCallback;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(poolOptions: PoolOptions, connectionOptions: ConnectionConfig, logger: DbLogger) {
        super();

        this.state = PoolState.active;
        this.pOptions = poolOptions;
        this.cOptions = connectionOptions;

        this.logger = logger;

        this.requests = [];
        this.clients = new Set();
        this.idle = new Map();
    }

    // PUBLIC PROPERTIES
    // --------------------------------------------------------------------------------------------
    get totalCount(): number {
        return this.clients.size;
    }

    get idleCount(): number {
        return this.idle.size;
    }

    get isFull(): boolean {
        return (this.clients.size >= this.pOptions.maxSize);
    }

    get isActive(): boolean {
        return (this.state === PoolState.active);
    }

    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    shutdown(callback: ShutdownCallback) {
        if (!this.isActive) {
            const error = new Error('Cannot shut down connection pool: the pool is not active');
            callback(error);
            return;
        }

        this.state = PoolState.closing;
        this.shutdownCallback = callback;

        if (!this.totalCount) {
            this.shutdownCallback();
        }

        // clear pending requests
        for (let request of this.requests) {
            const error = new ConnectionError('Connection pool is shutting down');
            request.reject(error);
        }

        // clear idle clients
        for (let client of this.idle.keys()) {
            this.removeClient(client);
        }
    }

    acquire(callback: ConnectionCallback) {
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
        request.setTimeout(this.pOptions.connectionTimeout, this.removeClient.bind(this));

        // if the pool is exhausted, queue the request and return
        if (this.clients.size >= this.pOptions.maxSize) {
            this.requests.push(request);
            return;
        }

        const start = process.hrtime();
        this.logger.debug('creating new connection');

        const client = new Client(this.cOptions);
        this.clients.add(client);
        request.setClient(client);
        client.connect((error) => {
            this.logger.trace('create connection', start, !error);
            if (error) {
                this.removeClient(client);
                request.reject(error);
                return;
            }

            this.emit(CREATED_EVENT, client);

            if (this.state === PoolState.closing) {
                // if the pool is shutting down, the request should already be rejected
                if (request.isPending) throw new Error('Pending request detected during shutdown');
                this.removeClient(client);
            }
            else {
                client.once('error', (error: Error) => {
                    client.on('error', (error: Error) => {
                        this.logger.debug('Client error after disconnect: ' + error.message);
                    });
                    this.removeClient(client);
                    this.emit(ERROR_EVENT, error, client);
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
    private addToIdle(client: Client) {
        if (!this.clients.has(client)) {
            throw new Error('Cannot add client to idle set: the client is missing from client set');
        }

        const idleTimeoutId = setTimeout(() => {
            this.logger.debug('Closing idle connection due to timeout');
            this.removeClient(client);
        }, this.pOptions.idleTimeout);

        this.idle.set(client, idleTimeoutId);
    }

    private removeClient(client: Client) {
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
            this.logger.debug('Connection closed' + (error ? ' with error: ' + error.message: ''));
            this.emit(CLOSED_EVENT, client);
        });

        if (this.state === PoolState.closing && this.clients.size === 0) {
            this.state = PoolState.closed;
            this.shutdownCallback();
        }
    }

    private releaseClient(client: Client, error?: Error) {
        client.release = undefined;

        if (error || this.state === PoolState.closing) {
            this.removeClient(client);
            return;
        }

        // find next pending request
        let request: ConnectionRequest;
        while (this.requests.length > 0) {
            request = this.requests.shift();
            if (request.isPending) break;
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

// HELPER CLASSES
// ================================================================================================
class ConnectionRequest {

    private client?     : Client;
    private callback?   : ConnectionCallback;
    private timeoutId?  : NodeJS.Timer;

    constructor(callback: ConnectionCallback) {
        this.callback = callback;
    }

    get isPending(): boolean {
        return (this.callback !== undefined);
    }

    setClient(client: Client): void {
        this.client = client;
    }

    setTimeout(ms: number, errorHandler: (client: Client) => void) {
        if (this.timeoutId) {
            throw new Error('Cannot set connection request timeout: the timeout is already set');
        }

        this.timeoutId = setTimeout(() => {
            if (this.isPending) {
                const error = new ConnectionError('Connection request has timed out');
                process.nextTick(this.callback, error);
                this.client && errorHandler(this.client);
                this.callback = undefined;
            }
        }, ms);
    }

    fulfill(client: Client, releaseHandler: (error?: Error) => void) {
        if (!this.isPending) {
            throw new Error('Cannot fulfill connection request: the request is not pending');
        }

        if (client.release !== undefined) {
            throw new Error('Cannot fulfill connection request: the client is not free')
        }

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        client.release = releaseHandler;
        process.nextTick(this.callback, undefined, client);
        this.callback = undefined;
    }

    reject(reason: Error) {
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
