// IMPORTS
// ================================================================================================
import { ConnectionSettings, PoolOptions } from './Database';
import { Session, SessionOptions } from './Session';
import { Logger } from './util';

// INTERFACES
// ================================================================================================
export interface Defaults {
    name                : string;
    SessionCtr          : typeof Session;
    connection          : ConnectionSettings;
    session             : SessionOptions;
    pool                : PoolOptions;
}

// DEFAULTS
// ================================================================================================
export const defaults: Defaults = {
    name                : 'database',
    SessionCtr          : Session,
    connection: {
        host            : undefined,
        port            : 5432,
        ssl             : false,
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
        maxSize          : 20,
        idleTimeout      : 30000,
        connectionTimeout: 1000
    }
};
