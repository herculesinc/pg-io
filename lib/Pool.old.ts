// IMPORTS
// ================================================================================================
import * as events from 'events';
import { ConnectionConfig, Client } from 'pg';
import { ConnectionError } from './errors';

// INTERFACES
// ================================================================================================
export interface PoolOptions {
    maxSize?           : number;
    idleTimeout?       : number;
    connectionTimeout? : number;
}

const enum PoolState {
    pending = 1, active = 2, closing = 3, closed = 4
}

// CLASS DEFINITION
// ================================================================================================
export class ConnectionPool extends events.EventEmitter {
    
    state               : PoolState;
    readonly pOptions   : PoolOptions;
    readonly cOptions   : ConnectionConfig;

    readonly requests   : ConnectionRequest[];
    readonly clients    : Set<Client>;
    readonly idle       : Map<Client, NodeJS.Timer>;

    shutdownRequest?    : ShutdownRequest;

    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(poolOptions: PoolOptions, connectionOptions: ConnectionConfig) {
        super();

        this.state = PoolState.active;

        this.pOptions = poolOptions;
        this.cOptions = connectionOptions;

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
    initialize(): Promise<any> {
        if (this.state !== PoolState.pending) {
            const error = new Error('Cannot initialize connection pool: the pool has already been initialized');
            return Promise.reject(error);
        }
        this.state = PoolState.active;
        return Promise.resolve();
    }

    shutdown(): Promise<any> {
        if (!this.isActive) {
            const error = new Error('Cannot shut down connection pool: the pool is not active');
            return Promise.reject(error);
        }

        this.state = PoolState.closing;
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

    acquire(): Promise<Client> {
        if (!this.isActive) {
            const error = new Error('Cannot acquire a connection from the pool: the pool is not active');
            return Promise.reject(error);
        }

        // create a connection request
        let request: ConnectionRequest;
        const clientPromise = new Promise<Client>((resolve, reject) => {
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

        const client = new Client(this.cOptions);
        this.clients.add(client);
        client.connect((error) => {
            // TODO: handle shutdown process
            if (error) {
                this.clients.delete(client);
                request.reject(error);
            }
            else {
                const errorHandler = (error: Error) => {
                    client.removeListener('error', errorHandler);
                    client.on('error', () => {
                        //this.log('additional client error after disconnection due to error', err)
                    })
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
    addToIdle(client: Client) {
        const idleTimeoutId = setTimeout(() => {
            this.removeClient(client);
        }, this.pOptions.idleTimeout);

        this.idle.set(client, idleTimeoutId);
    }

    removeClient(client: Client) {
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

// HELPER CLASSES
// ================================================================================================
class ConnectionRequest {

    private resolver?   : (client: Client) => void;
    private rejector?   : (error: Error) => void;
    private timeoutId?  : NodeJS.Timer;

    constructor(resolver: (client: Client) => void, rejector: (error: Error) => void) {
        this.resolver = resolver;
        this.rejector = rejector;
    }

    get isPending(): boolean {
        return (this.resolver !== undefined);
    }

    setTimeout(ms: number) {
        if (this.timeoutId) {
            throw new Error('Cannot set connection request timeout: the timeout is already set');
        }

        this.timeoutId = setTimeout(() => {
            if (this.isPending) {
                const error = new ConnectionError('Connection request has timed out');
                process.nextTick(this.rejector, error);
                this.resolver = undefined;
                this.rejector = undefined;
            }
        }, ms);
    }

    fulfill(client: Client, pool: ConnectionPool) {
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

        client.release = releaseHandler.bind(pool, client);

        process.nextTick(this.resolver, client);
        this.resolver = undefined;
        this.rejector = undefined;
    }

    reject(reason: Error) {
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
    private resolver?   : (client: Client) => void;
    private rejector?   : (error: Error) => void;

    constructor(resolver: (client: Client) => void, rejector: (error: Error) => void) {
        this.resolver = resolver;
        this.rejector = rejector;
    }

    complete() {
        process.nextTick(this.resolver);
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function releaseHandler(this: ConnectionPool, client: Client, error?: Error) {
    client.release = undefined;

    if (error) {

    }

    // get next pending request
    let request: ConnectionRequest;
    while (this.requests.length > 0) {
        request = this.requests.shift();
        if (request.isPending) break;
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