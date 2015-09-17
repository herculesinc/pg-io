'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.isResultQuery = isResultQuery;
exports.isParametrized = isParametrized;
exports.toDbQuery = toDbQuery;

var _errors = require('./errors');

// MODULE VARIABLES
// ================================================================================================
var paramPattern = /{{([a-z0-9\$_]+)}}/gi;
// PUBLIC FUNCTIONS
// ================================================================================================

function isResultQuery(query) {
    return 'mask' in query;
}

function isParametrized(query) {
    return 'values' in query || 'params' in query;
}

function toDbQuery(query) {
    validateQuery(query);
    if (query.params) {
        var params = [];
        var text = query.text.replace(paramPattern, function (match, paramName) {
            var _processParam = processParam(query.params[paramName]);

            var paramValue = _processParam.paramValue;
            var isSafe = _processParam.isSafe;

            return isSafe ? paramValue : '$' + params.push(paramValue);
        });
        return {
            text: formatQueryText(text),
            values: params.length > 0 ? params : undefined
        };
    } else {
        return { text: formatQueryText(query.text) };
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function validateQuery(query) {
    if (query.text === undefined || query.text === null || query.text.trim() === '') throw new _errors.QueryError('Invalid query: query text cannot be empty');
}
function processParam(value) {
    var isSafe = true;
    var paramValue;
    if (value === null || value === undefined) {
        paramValue = 'null';
    } else {
        switch (typeof value) {
            case 'number':
            case 'boolean':
                paramValue = value.toString();
                break;
            case 'string':
                isSafe = isSafeString(value);
                paramValue = isSafe ? `'${ value }'` : value;
                break;
            case 'function':
                throw new _errors.QueryError('Query parameter cannot be a function');
            default:
                if (value instanceof Date) {
                    paramValue = `'${ value.toISOString() }'`;
                }
                if (value instanceof Array) {
                    // TODO: implement array parametrizaton
                    throw new _errors.QueryError('Query parameter cannot be an array');
                }
                paramValue = JSON.stringify(value);
                isSafe = isSafeString(paramValue);
                paramValue = isSafe ? `'${ paramValue }'` : paramValue;
        }
    }
    return { paramValue, isSafe };
}
function isSafeString(value) {
    return value.indexOf('\'') === -1 && value.indexOf(`\\`) === -1;
}
function formatQueryText(text) {
    text = text.trim();
    text += text.charAt(text.length - 1) !== ';' ? ';\n' : '\n';
    return text;
}
//# sourceMappingURL=../../bin/lib/Query.js.map