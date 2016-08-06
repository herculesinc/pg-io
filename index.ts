// IMPORTS
// ================================================================================================
import { since } from './lib/util';

// INTERFACES
// ================================================================================================
export interface Utilities {
    since(start: number[]): number;
}

// GLOBALS
// ================================================================================================
export const util: Utilities = {
    since: since
}

// RE-EXPORTS
// ================================================================================================
export { Database } from './lib/Database';
export { defaults } from './lib/defaults';
export { Session } from './lib/Session';
export { PgError, ConnectionError, TransactionError, QueryError, ParseError } from './lib/errors';