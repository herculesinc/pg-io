// IMPORTS
// ================================================================================================
var pg = require('pg'); // needed for Babel transpilation
import { ConnectionError } from './lib/errors'
import { Connection, Options } from './lib/Connection';

// INTERFACES
// ================================================================================================
export interface Settings {
    host        : string;
    port?       : number;
    user        : string;
    password    : string;
    database    : string;
    poolSize?   : number;
};

export interface PoolState {
    size        : number;
    available   : number;
}

// GLOBALS
// ================================================================================================
var databases = new Map<string, Database>();

// export connection contructor to enable overriding
export var constructors = {
    connection: Connection
};

// export defaults to enable overriding
export var defaults: Options = {
    collapseQueries : false,
    startTransaction: false
};

export function db(settings: Settings): Database {
    var db = databases.get(JSON.stringify(settings));
    if (db === undefined) {
        db = new Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
};

// DATABASE CLASS
// ================================================================================================
class Database {

    settings: Settings;
    
    constructor(settings: Settings) {
        this.settings = settings;
    }

    connect(options?: Options): Promise<Connection> {
        options = Object.assign({}, defaults, options);
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (error, client, done) => {
                if (error) return reject(new ConnectionError(error));
                var connection = new constructors.connection(options, client, done);
                resolve(connection);
            });
        });
    }

    getPoolState(): PoolState {
        var pool = pg.pools.getOrCreate(this.settings);
        return {
            size: pool.getPoolSize(),
            available: pool.availableObjectsCount()
        };
    }
}

// RE-EXPORTS
// ================================================================================================
export { Connection } from './lib/Connection';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';