"use strict";
// MODULE VARIABLES
// ================================================================================================
const NOOP = function () { };
const noopLogger = {
    debug: NOOP,
    info: NOOP,
    warn: NOOP,
    trace: NOOP
};
// LOGGER
// ================================================================================================
function buildLogger(dbName, logger) {
    if (!logger)
        return noopLogger;
    if (typeof logger !== 'object')
        throw new TypeError('Logger is invalid');
    if (typeof logger.debug !== 'function')
        throw new TypeError('Logger is invalid');
    if (typeof logger.info !== 'function')
        throw new TypeError('Logger is invalid');
    if (typeof logger.warn !== 'function')
        throw new TypeError('Logger is invalid');
    if (typeof logger.trace !== 'function')
        throw new TypeError('Logger is invalid');
    return new DatabaseLogger(dbName, logger);
}
exports.buildLogger = buildLogger;
class DatabaseLogger {
    constructor(dbName, logger) {
        this.dbName = dbName;
        this.logger = logger;
    }
    debug(message) {
        this.logger.debug(message, this.dbName);
    }
    info(message) {
        this.logger.info(message, this.dbName);
    }
    warn(message) {
        this.logger.warn(message, this.dbName);
    }
    trace(command, start, success = true) {
        this.logger.trace(this.dbName, command, since(start), success);
    }
}
// TIMER
// ================================================================================================
function since(start) {
    const diff = process.hrtime(start);
    return diff[0] * 1000 + Math.floor(diff[1] / 100000) / 10;
}
exports.since = since;
//# sourceMappingURL=util.js.map