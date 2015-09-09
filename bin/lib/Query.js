// IMPORTS
// ================================================================================================
var errors_1 = require('./errors');
// MODULE VARIABLES
// ================================================================================================
var paramPattern = /{{([a-z0-9\$_]+)}}/gi;
// PUBLIC FUNCTIONS
// ================================================================================================
function isResultQuery(query) {
    return ('mask' in query);
}
exports.isResultQuery = isResultQuery;
function isParametrized(query) {
    return ('values' in query || 'params' in query);
}
exports.isParametrized = isParametrized;
function toDbQuery(query) {
    validateQuery(query);
    if (query.params) {
        var params = [];
        var text = query.text.replace(paramPattern, function (match, paramName) {
            var _a = processParam(query.params[paramName]), paramValue = _a.paramValue, isSafe = _a.isSafe;
            return isSafe ? paramValue : '$' + params.push(paramValue);
        });
        return {
            text: formatQueryText(text),
            values: params.length > 0 ? params : undefined,
        };
    }
    else {
        return { text: formatQueryText(query.text) };
    }
}
exports.toDbQuery = toDbQuery;
// HELPER FUNCTIONS
// ================================================================================================
function validateQuery(query) {
    if (query.text === undefined || query.text === null || query.text.trim() === '')
        throw new errors_1.PgError('Invalid query: query text cannot be empty');
}
function processParam(value) {
    var isSafe = true;
    var paramValue;
    if (value === null || value === undefined) {
        paramValue = 'null';
    }
    else {
        switch (typeof value) {
            case 'number':
            case 'boolean':
                paramValue = value.toString();
                break;
            case 'string':
                isSafe = isSafeString(value);
                paramValue = isSafe ? "'" + value + "'" : value;
                break;
            case 'function':
                throw new Error('Query parameter cannot be a function');
            default:
                if (value instanceof Date) {
                    paramValue = "'" + value.toISOString() + "'";
                }
                if (value instanceof Array) {
                    throw new Error('Query parameter cannot be an array');
                }
                paramValue = JSON.stringify(value);
                isSafe = isSafeString(paramValue);
                paramValue = isSafe ? "'" + paramValue + "'" : paramValue;
        }
    }
    return { paramValue: paramValue, isSafe: isSafe };
}
function isSafeString(value) {
    return (value.indexOf('\'') === -1 && value.indexOf("\\") === -1);
}
function formatQueryText(text) {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return text;
}
//# sourceMappingURL=Query.js.map