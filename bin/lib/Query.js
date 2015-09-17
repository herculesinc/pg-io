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
            var param = query.params[paramName];
            if (param && Array.isArray(param)) {
                return stringifyArrayParam(param, params);
            } else {
                return stringifySingleParam(param, params);
            }
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
function stringifySingleParam(value, params) {
    if (value === null || value === undefined) return 'null';
    switch (typeof value) {
        case 'number':
        case 'boolean':
            return value.toString();
        case 'string':
            return isSafeString(value) ? `'${ value }'` : '$' + params.push(value);
        case 'function':
            throw new _errors.QueryError('Query parameter cannot be a function');
        default:
            if (value instanceof Date) {
                return `'${ value.toISOString() }'`;
            } else if (value instanceof Array) {
                throw new _errors.QueryError('Somehting went wrong with preparing array parameters');
            } else {
                var paramValue = value.valueOf();
                if (typeof paramValue === 'object') {
                    paramValue = JSON.stringify(value);
                }
                return stringifySingleParam(paramValue, params);
            }
    }
}
function stringifyArrayParam(values, params) {
    if (values === null || values === undefined || values.length === 0) return 'null';
    var paramValues = [];
    var arrayType = typeof values[0];
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (value === null || value === undefined) continue;
        var valueType = typeof value;
        if (valueType !== arrayType) throw new _errors.QueryError('Query parameter cannot be an array of mixed values');
        if (valueType === 'string') {
            if (isSafeString(value)) {
                paramValues.push(`'${ value }'`);
            } else {
                paramValues.push('$' + params.push(value));
            }
        } else if (valueType === 'number') {
            paramValues.push(value.toString());
        } else {
            throw new _errors.QueryError(`Query parameter array cannot contain ${ valueType } values`);
        }
    }
    return paramValues.join(',');
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