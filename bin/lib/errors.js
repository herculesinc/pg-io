"use strict";
class PgError extends Error {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super(messageOrCause);
            this.cause = cause;
        }
        else {
            super(messageOrCause.message);
            this.cause = messageOrCause;
        }
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.PgError = PgError;
class ConnectionError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'Connection Error';
    }
}
exports.ConnectionError = ConnectionError;
class TransactionError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'Transaction Error';
    }
}
exports.TransactionError = TransactionError;
class QueryError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'Query Error';
    }
}
exports.QueryError = QueryError;
class ParseError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'Parse Error';
    }
}
exports.ParseError = ParseError;
//# sourceMappingURL=errors.js.map