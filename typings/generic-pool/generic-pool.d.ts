declare module 'generic-pool' {

    interface Factory<T> {
  
        /** name of pool */
        name?: string

        /** function that returns a new resource, should call callback with the created resource */
        create: (callback: (err: Error | void, client?: T) => void) => void

        /** function that accepts a resource and destroys it */
        destroy: (client: T) => void

        /** maximum number of resources to create at any given time (optional, default=1) */
        max?: number

        /**
        * minimum number of resources to keep in pool at any given time
        * if this is set >= max, the pool will silently set the min to factory.max - 1 (Note: min==max case is expected to change in v3 release)
        * optional (default=0)
        */
        min?: number

        /** boolean that specifies whether idle resources at or below the min threshold should be destroyed/re-created. optional (default=true) */
        refreshIdle?: boolean

        /** max milliseconds a resource can go unused before it should be destroyed (default 30000) */
        idleTimeoutMillis?: number

        /** frequency to check for idle resources (default 1000) */
        reapIntervalMillis?: number

        /**
         * boolean, if true the most recently released resources will be the first to be allocated.
         * This in effect turns the pool's behaviour from a queue into a stack. optional (default false)
         */
        returnToHead?: boolean

        /** int between 1 and x - if set, borrowers can specify their relative priority in the queue if no resources are available. (default 1) */
        priorityRange?: number

        /**
         * function that accepts a pooled resource and returns true if the resource is OK to use, or false if the object is invalid.
         * Invalid objects will be destroyed. This function is called in acquire() before returning a resource from the pool.
         * Optional. Default function always returns true.
         */
        validate?: (client: T) => boolean

        /**
         * Asynchronous validate function.
         * Receives a callback function as its second argument, which should be called with a single boolean argument being true if the item is still valid and false if it should be removed from the pool.
         * Called before item is acquired from pool. Default is undefined.
         * Only one of validate/validateAsync may be specified
         */
        validateAsync?: (client: T, callback: (remove: boolean) => void) => void

        /**
         * If a log is a function, it will be called with two parameters:
         *  - log string
         *  - log level ('verbose', 'info', 'warn', 'error')
         * Else if log is true, verbose log info will be sent to console.log()
         * Else internal log messages be ignored (this is the default)
         */
        log?: boolean | ((log: string, level: 'verbose' | 'info' | 'warn' | 'error') => void)
    }

    export class Pool<T> {

        constructor(factory: Factory<T>)

        /** Request a new client. The callback will be called, when a new client will be availabe, passing the client to it. */
        acquire(callback: (err?: Error, client?: T) => void, priority?: number): boolean

        /** Return the client to the pool, in case it is no longer required */
        release(client: T): void

        /** Disallow any new requests and let the request backlog dissapate. */
        drain(callback: () => void): void

        /** Request the client to be destroyed. The factory's destroy handler will also be called. */
        destroy(client: T): void

        /**
         * Forcibly destroys all clients regardless of timeout. Intended to be 
         * invoked as part of a drain. Does not prevent the creation of new 
         * clients as a result of subsequent calls to acquire. 
         * 
         * Note that if factory.min > 0, the pool will destroy all idle resources 
         * in the pool, but replace them with newly created resources up to the 
         * specified factory.min value.  If this is not desired, set factory.min 
         * to zero before calling destroyAllNow() 
         */
        destroyAllNow(): void

        /** Decorates a function to use a acquired client from the object pool when called. */
        pooled(callback: (client: T, ...args: any[]) => any, priority?: number): (...args: any[]) => void

        /** returns factory.name for this pool */
        getName(): string

        /** returns number of resources in the pool regardless of whether they are free or in use */
        getPoolSize(): number

        /** returns number of unused resources in the pool */
        availableObjectsCount(): number

        /** returns number of callers waiting to acquire a resource */
        waitingClientsCount(): number

        /** returns number of maxixmum number of resources allowed by pool */
        getMaxPoolSize(): number

        /** returns number of minimum number of resources allowed by pool */
        getMinPoolSize(): number
    }
}