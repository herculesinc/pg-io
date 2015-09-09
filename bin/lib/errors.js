var util = require('util');
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