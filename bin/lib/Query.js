"use strict";
// IMPORTS
// ================================================================================================
const errors_1 = require("./errors");
// MODULE VARIABLES
// ================================================================================================
const PARAM_PATTERN = /{{([a-z0-9\$_]+)}}/gi;
const ARRAY_PARAM_PATTERN = /\[\[([a-z0-9\$_]+)\]\]/gi;
function Query(spec, params, mask) {
    if (!spec)
        return undefined;
    if (mask && (mask !== 'list' || 'object')) {
        throw new errors_1.QueryError(`Invalid query mask: value '${mask}' is not supported`);
    }
    return {
        name: spec.name,
        text: spec.text,
        params: params,
        mask: mask
    };
}
exports.Query = Query;
function isResultQuery(query) {
    const queryMask = query['mask'];
    if (queryMask === 'object' || queryMask === 'list') {
        return true;
    }
    else if (queryMask) {
        throw new errors_1.QueryError(`Invalid query mask: value '${queryMask}' is not supported`);
    }
    else {
        return false;
    }
}
exports.isResultQuery = isResultQuery;
function isParametrized(query) {
    return (query['values'] || query['params']);
}
exports.isParametrized = isParametrized;
function toDbQuery(query) {
    if (query == undefined || query.text == undefined || query.text.trim() === '')
        throw new errors_1.QueryError('Invalid query: query text cannot be empty');
    if (query.params) {
        const params = [];
        let text = query.text.replace(PARAM_PATTERN, function (match, paramName) {
            const param = query.params[paramName];
            return stringifySingleParam(param, params);
        });
        text = text.replace(ARRAY_PARAM_PATTERN, function (match, paramName) {
            const param = query.params[paramName];
            if (param && !Array.isArray(param))
                throw new errors_1.QueryError('Invalid query: non-array supplied for array parameter');
            return stringifyArrayParam(param, params);
        });
        return {
            text: formatQueryText(text),
            values: params.length > 0 ? params : undefined,
        };
    }
    else {
        return {
            text: formatQueryText(query.text)
        };
    }
}
exports.toDbQuery = toDbQuery;
// HELPER FUNCTIONS
// ================================================================================================
function stringifySingleParam(value, params) {
    if (value == undefined)
        return 'null';
    switch (typeof value) {
        case 'number':
        case 'boolean':
            return value.toString();
        case 'string':
            return isSafeString(value) ? `'${value}'` : '$' + params.push(value);
        case 'function':
            let paramValue = value.valueOf();
            if (typeof paramValue === 'function') {
                throw new errors_1.QueryError('Query parameter cannot be a function');
            }
            return stringifySingleParam(paramValue, params);
        default:
            if (value instanceof Date) {
                return `'${value.toISOString()}'`;
            }
            else {
                let paramValue = value.valueOf();
                if (typeof paramValue === 'object') {
                    paramValue = JSON.stringify(value);
                }
                return stringifySingleParam(paramValue, params);
            }
    }
}
function stringifyArrayParam(values, params) {
    if (values == undefined || values.length === 0)
        return 'null';
    const paramValues = [];
    const arrayType = typeof values[0];
    for (let value of values) {
        if (value == undefined)
            continue;
        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new errors_1.QueryError('Query parameter cannot be an array of mixed values');
        if (valueType === 'string') {
            if (isSafeString(value)) {
                paramValues.push(`'${value}'`);
            }
            else {
                paramValues.push('$' + params.push(value));
            }
        }
        else if (valueType === 'number') {
            paramValues.push(value.toString());
        }
        else {
            throw new errors_1.QueryError(`Query parameter array cannot contain ${valueType} values`);
        }
    }
    return paramValues.join(',');
}
function isSafeString(value) {
    return (!value.includes('\'') && !value.includes(`\\`));
}
function formatQueryText(text) {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return text;
}
//# sourceMappingURL=Query.js.map