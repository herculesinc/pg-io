// IMPORTS
// ================================================================================================
import { Database, DatabaseOptions } from './lib/Database';
import { since } from './lib/util';

// INTERFACES
// ================================================================================================
export interface Utilities {
    since(start: number[]): number;
}

// GLOBALS
// ================================================================================================
const databases = new Map<string, Database>();

// exported utils
export const utils: Utilities = {
    since: since
}

// database getter
export function db(options: DatabaseOptions): Database {
    var db = databases.get(JSON.stringify(options.connection));
    if (db === undefined) {
        options = Object.assign({}, options);
        db = new Database(options);
        databases.set(JSON.stringify(options.connection), db);
    }
    return db;
}

// RE-EXPORTS
// ================================================================================================
export { defaults } from './lib/defaults';
export { Session } from './lib/Session';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';