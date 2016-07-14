"use strict";
const Session_1 = require('./Session');
// DEFAULTS
// ================================================================================================
exports.defaults = {
    application: undefined,
    SessionConstructor: Session_1.Session,
    connection: {
        host: undefined,
        port: 5432,
        user: undefined,
        password: undefined,
        database: undefined,
    },
    session: {
        startTransaction: false,
        collapseQueries: false,
        logQueryText: false
    },
    pool: {
        maxSize: 20,
        idleTimeout: 30000,
        reapInterval: 1000
    },
    logger: undefined
};
//# sourceMappingURL=defaults.js.map