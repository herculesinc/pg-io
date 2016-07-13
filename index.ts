// IMPORTS
// ================================================================================================
import { Connection, Options } from './lib/Connection';
import { Database, Settings} from './lib/Database';
import { since } from './lib/util';

// INTERFACES
// ================================================================================================

export interface Configuration {
    cc          : typeof Connection,
    logger      : Logger,
    logQueryText: boolean;
}

export interface Logger {
    debug(message: string);
    info(message: string);
    warn(message: string);

    error(error: Error);

    log(event: string, properties?: { [key: string]: any });
    track(metric: string, value: number);
    trace(service: string, command: string, time: number, success?: boolean);
}

export interface Utilities {
    since(start: number[]): number;
}

// GLOBALS
// ================================================================================================
const databases = new Map<string, Database>();

// export library configurations
export const config: Configuration = {
    cc          : Connection,
    logger      : undefined,
    logQueryText: false
};

// export defaults to enable overriding
export const defaults: Options = {
    collapseQueries : false,
    startTransaction: false
};

// exported utils
export const utils: Utilities = {
    since: since
}

// database getter
export function db(settings: Settings): Database {
    var db = databases.get(JSON.stringify(settings));
    if (db === undefined) {
        db = new Database(settings);
        databases.set(JSON.stringify(settings), db);
    }
    return db;
};

// RE-EXPORTS
// ================================================================================================
export { Connection } from './lib/Connection';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';