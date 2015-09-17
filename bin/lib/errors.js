'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

class PgError extends Error {
    constructor(messageOrCause, cause) {
        if (typeof messageOrCause === 'string') {
            super(messageOrCause);
            this.cause = cause;
        } else {
            super(messageOrCause.message);
            this.cause = messageOrCause;
        }
    }
}

exports.PgError = PgError;

class ConnectionError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'ConnectionError';
        Error.captureStackTrace(this, ConnectionError);
    }
}

exports.ConnectionError = ConnectionError;

class TransactionError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'TransactionError';
        Error.captureStackTrace(this, TransactionError);
    }
}

exports.TransactionError = TransactionError;

class QueryError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'QueryError';
        Error.captureStackTrace(this, QueryError);
    }
}

exports.QueryError = QueryError;

class ParseError extends PgError {
    constructor(messageOrCause, cause) {
        super(messageOrCause, cause);
        this.name = 'ParseError';
        Error.captureStackTrace(this, ParseError);
    }
}

exports.ParseError = ParseError;
//# sourceMappingURL=../../bin/lib/errors.js.map