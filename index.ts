// IMPORTS
// ================================================================================================
import * as pg from 'pg';

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
    size: number;
    available: number;
}

// GLOBALS
// ================================================================================================
pg.defaults.parseInt8 = true;

var databases = new Map<string, Database>();

export var ConnectionConstructor = Connection;

export var defaults: Options = {
    collapseQueries : false,
    startTransaction: false
}

export function db(settings: Settings): Database {
    var db = databases.get(JSON.stringify(settings));
    if (db === undefined) {
        db = new Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
}

// DATABASE CLASS
// ================================================================================================
class Database {

    settings: Settings;
    
    constructor(settings: Settings) {
        this.settings = settings;
    }

    connect(options?: Options): Promise<Connection> {
        // TODO: use Object.assign() to merge options
        if (options){
            for (var option in defaults) {
                options[option] = (options[option] === undefined) ? defaults[option] : options[option];
            }    
        }
        else {
            options = defaults;
        }
        
        return new Promise((resolve, reject) => {
            pg.connect(this.settings, (err, client, done) => {
                if (err) return reject(err);
                var dao = new ConnectionConstructor(options, client, done);
                resolve(dao);
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