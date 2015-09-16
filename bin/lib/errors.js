var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var PgError = (function (_super) {
    __extends(PgError, _super);
    function PgError(messageOrCause, cause) {
        _super.call(this, typeof messageOrCause === 'string' ? messageOrCause : messageOrCause.message);
        this.name = 'PgError';
        if (typeof messageOrCause === 'string') {
            this.message = messageOrCause;
            if (cause) {
                this.cause = cause;
                this.message += ': ' + cause.message;
            }
        }
        else {
            this.message = messageOrCause.message;
            this.cause = messageOrCause;
        }
    }
    return PgError;
})(Error);
exports.PgError = PgError;
var ConnectionError = (function (_super) {
    __extends(ConnectionError, _super);
    function ConnectionError(messageOrCause, cause) {
        _super.call(this, messageOrCause, cause);
        this.name = 'ConnectionError';
        Error.captureStackTrace(this, ConnectionError);
    }
    return ConnectionError;
})(PgError);
exports.ConnectionError = ConnectionError;
var ConnectionStateError = (function (_super) {
    __extends(ConnectionStateError, _super);
    function ConnectionStateError(messageOrCause, cause) {
        _super.call(this, messageOrCause, cause);
        this.name = 'ConnectionStateError';
        Error.captureStackTrace(this, ConnectionStateError);
    }
    return ConnectionStateError;
})(PgError);
exports.ConnectionStateError = ConnectionStateError;
var QueryError = (function (_super) {
    __extends(QueryError, _super);
    function QueryError(messageOrCause, cause) {
        _super.call(this, messageOrCause, cause);
        this.name = 'QueryError';
        Error.captureStackTrace(this, QueryError);
    }
    return QueryError;
})(PgError);
exports.QueryError = QueryError;
var ParseError = (function (_super) {
    __extends(ParseError, _super);
    function ParseError(messageOrCause, cause) {
        _super.call(this, messageOrCause, cause);
        this.name = 'ParseError';
        Error.captureStackTrace(this, ParseError);
    }
    return ParseError;
})(PgError);
exports.ParseError = ParseError;
//# sourceMappingURL=errors.js.map