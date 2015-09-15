var util = require('util');
// TODO: create more specialized errors
var PgError = (function () {
    function PgError(message) {
        Error.call(this);
        this.message = message;
    }
    return PgError;
})();
exports.PgError = PgError;
util.inherits(PgError, Error);
//# sourceMappingURL=errors.js.map