"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Session_1 = require("./Session");
// DEFAULTS
// ================================================================================================
exports.defaults = {
    name: 'database',
    SessionCtr: Session_1.Session,
    connection: {
        host: undefined,
        port: 5432,
        ssl: false,
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
    }
};
//# sourceMappingURL=defaults.js.map