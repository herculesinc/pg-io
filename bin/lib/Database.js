"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const events = require("events");
const errors_1 = require("./errors");
const Pool_1 = require("./Pool");
const defaults_1 = require("./defaults");
const util_1 = require("./util");
// MODULE VARIABLES
// ================================================================================================
exports.ERROR_EVENT = 'error';
// DATABASE CLASS
// ================================================================================================
class Database extends events.EventEmitter {
    // CONSTRUCTOR
    // --------------------------------------------------------------------------------------------
    constructor(options, logger, SessionCtr) {
        super();
        if (!options)
            throw TypeError('Cannot create a Database: options are undefined');
        if (!options.connection)
            throw TypeError('Cannot create a Database: connection options are undefined');
        // set basic properties
        this.name = options.name || defaults_1.defaults.name;
        this.Session = SessionCtr || defaults_1.defaults.SessionCtr;
        this.sOptions = validateSessionOptions(options.session);
        this.logger = util_1.buildLogger(this.name, logger);
        // initialize connection pool
        const connectionOptions = validateConnectionOptions(options.connection);
        this.pool = new Pool_1.ConnectionPool(options.pool, connectionOptions, this.logger);
        this.pool.on('error', (error) => {
            this.emit(exports.ERROR_EVENT, error);
        });
    }
    // PUBLIC METHODS
    // --------------------------------------------------------------------------------------------
    connect(options) {
        options = validateSessionOptions(options);
        const start = process.hrtime();
        this.logger.debug(`Connecting to the database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.acquire((error, client) => {
                this.logger.trace('acquire connection', start, !error);
                if (error) {
                    reject(new errors_1.ConnectionError(error));
                }
                else {
                    const session = new this.Session(client, options, this.logger);
                    resolve(session);
                }
            });
        });
    }
    close() {
        const start = process.hrtime();
        this.logger.debug(`Closing database; pool state ${this.getPoolDescription()}`);
        return new Promise((resolve, reject) => {
            this.pool.shutdown((error) => {
                this.logger.trace('close database', start, !error);
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    // POOL INFO ACCESSORS
    // --------------------------------------------------------------------------------------------
    getPoolState() {
        return {
            size: this.pool.totalCount,
            idle: this.pool.idleCount
        };
    }
    getPoolDescription() {
        return `{ size: ${this.pool.totalCount}, idle: ${this.pool.idleCount} }`;
    }
}
exports.Database = Database;
// HELPER FUNCTIONS
// ================================================================================================
function validateConnectionOptions(options) {
    options = Object.assign({}, defaults_1.defaults.connection, options);
    if (typeof options.host !== 'string')
        throw new TypeError('Connection options are invalid');
    if (typeof options.port !== 'number')
        throw new TypeError('Connection options are invalid');
    if (typeof options.ssl !== 'boolean')
        throw new TypeError('Connection options are invalid');
    if (typeof options.database !== 'string')
        throw new TypeError('Connection options are invalid');
    if (typeof options.user !== 'string')
        throw new TypeError('Connection options are invalid');
    if (typeof options.password !== 'string')
        throw new TypeError('Connection options are invalid');
    return options;
}
function validateSessionOptions(options) {
    options = Object.assign({}, defaults_1.defaults.session, options);
    if (typeof options.startTransaction !== 'boolean')
        throw new TypeError('Session options are invalid');
    if (typeof options.collapseQueries !== 'boolean')
        throw new TypeError('Session options are invalid');
    if (typeof options.logQueryText !== 'boolean')
        throw new TypeError('Session options are invalid');
    if (typeof options.timeout !== 'number')
        throw new TypeError('Session options are invalid');
    if (options.timeout <= 0)
        throw new TypeError('Session options are invalid');
    if (!Number.isInteger(options.timeout))
        throw new TypeError('Session options are invalid');
    return options;
}
//# sourceMappingURL=Database.js.map