// IMPORTS
// ================================================================================================
import { ConnectionSettings, PoolOptions } from './Database';
import { Session, SessionOptions } from './Session';
import { Logger } from './util';

// INTERFACES
// ================================================================================================
export interface Defaults {
    application         : string;
    SessionConstructor  : typeof Session;
    connection          : ConnectionSettings;
    session             : SessionOptions;
    pool                : PoolOptions;
    logger              : Logger;
}

// DEFAULTS
// ================================================================================================
export const defaults: Defaults = {
    application         : undefined,
    SessionConstructor  : Session,
    connection: {
        host            : undefined,
        port            : 5432,
        user            : undefined,
        password        : undefined,
        database        : undefined,
    },
    session: {
        startTransaction: false,
        collapseQueries : false,
        logQueryText    : false
    },
    pool: {
        maxSize         : 20,
        idleTimeout     : 30000,
        reapInterval    : 1000
    },
    logger              : undefined
};