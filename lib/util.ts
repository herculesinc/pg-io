// INTERFACES
// ================================================================================================
export interface Logger {
    debug(message: string, source?: string);
    info(message: string, source?: string);
    warn(message: string, source?: string);
    trace(source: string, command: string, time: number, success?: boolean);
}

export interface DbLogger {
    debug(message: string);
    info(message: string);
    warn(message: string);
    trace(command: string, start: [number, number], success?: boolean)
}

// MODULE VARIABLES
// ================================================================================================
const NOOP = function() {};
const noopLogger: DbLogger = {
    debug   : NOOP,
    info    : NOOP,
    warn    : NOOP,
    trace   : NOOP
};

// LOGGER
// ================================================================================================
export function buildLogger(dbName: string, logger?: Logger): DbLogger {
    if (!logger) return noopLogger;

    if (typeof logger !== 'object') throw new TypeError('Logger is invalid');
    if (typeof logger.debug !== 'function') throw new TypeError('Logger is invalid');
    if (typeof logger.info !== 'function') throw new TypeError('Logger is invalid');
    if (typeof logger.warn !== 'function') throw new TypeError('Logger is invalid');
    if (typeof logger.trace !== 'function') throw new TypeError('Logger is invalid');

    return new DatabaseLogger(dbName, logger);
}

class DatabaseLogger implements DbLogger {

    private readonly dbName: string;
    private readonly logger: Logger;

    constructor (dbName: string, logger: Logger) {
        this.dbName = dbName;
        this.logger = logger;
    }

    debug(message: string) {
        this.logger.debug(message, this.dbName);
    }

    info(message: string) {
        this.logger.info(message, this.dbName);
    }

    warn(message: string) {
        this.logger.warn(message, this.dbName);
    }

    trace(command: string, start: [number, number], success = true) {
        this.logger.trace(this.dbName, command, since(start), success);
    }
}

// TIMER
// ================================================================================================
export function since(start: [number, number]) {
    const diff = process.hrtime(start);
    return diff[0] * 1000 + Math.floor(diff[1] / 100000) / 10;
}
