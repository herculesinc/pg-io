"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// IMPORTS
// ================================================================================================
const errors_1 = require("./errors");
// MODULE VARIABLES
// ================================================================================================
const SINGLE_PARAM_PATTERN = /{{(~?[a-z0-9_]+)}}/i;
const ARRAY_PARAM_PATTERN = /\[\[(~?[a-z0-9_]+)\]\]/i;
const PARAM_PATTERN = /{{~?[a-z0-9_]+}}|\[\[~?[a-z0-9_]+\]\]/gi;
// QUERY NAMESPACE
// ================================================================================================
var Query;
(function (Query) {
    function from(text, nameOrOptions, options) {
        const validated = validateQueryArguments(text, nameOrOptions, options);
        if (validated.options) {
            return {
                text: validated.text,
                name: validated.name,
                mask: validated.options.mask,
                mode: validated.options.mode,
                handler: validated.options.handler
            };
        }
        else {
            return {
                text: validated.text,
                name: validated.name
            };
        }
    }
    Query.from = from;
    function template(text, nameOrOptions, options) {
        const validated = validateQueryArguments(text, nameOrOptions, options);
        const textParts = validated.text.split(PARAM_PATTERN);
        if (textParts.length < 2)
            throw new Error('Query text must contain at least one parameter');
        const paramMatches = text.match(PARAM_PATTERN);
        const paramSpecs = [];
        for (let match of paramMatches) {
            paramSpecs.push(buildParamSpec(match));
        }
        return buildQueryTemplate(validated.name, textParts, paramSpecs, validated.options);
    }
    Query.template = template;
})(Query = exports.Query || (exports.Query = {}));
// PUBLIC FUNCTIONS
// ================================================================================================
function toPgQuery(query) {
    if (query == undefined || query.text == undefined || query.text.trim() === '')
        throw new errors_1.QueryError('Invalid query: query text cannot be empty');
    if (query.values) {
        const params = [];
        let text = query.text.replace(PARAM_PATTERN, function (match, paramName) {
            const param = query.values[paramName];
            return stringifySingleParam(param, params);
        });
        text = text.replace(ARRAY_PARAM_PATTERN, function (match, paramName) {
            const param = query.values[paramName];
            if (param && !Array.isArray(param))
                throw new errors_1.QueryError('Invalid query: non-array supplied for array parameter');
            return stringifyArrayParam(param, params);
        });
        return {
            text: formatQueryText(text),
            rowMode: query.mode === 'array' ? 'array' : undefined,
            values: params.length > 0 ? params : undefined,
        };
    }
    else {
        return {
            text: formatQueryText(query.text),
            rowMode: query.mode === 'array' ? 'array' : undefined
        };
    }
}
exports.toPgQuery = toPgQuery;
function isResultQuery(query) {
    const queryMask = query.mask;
    if (queryMask === 'single' || queryMask === 'list') {
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
// HELPER FUNCTIONS
// ================================================================================================
function buildQueryTemplate(name, textParts, paramSpecs, options) {
    return class ParametrizedQuery {
        constructor(params) {
            if (!params)
                throw new TypeError('Query params are undefined');
            if (typeof params !== 'object')
                throw new TypeError('Query params must be an object');
            const values = [];
            let text = textParts[0];
            for (let i = 0; i < paramSpecs.length; i++) {
                let paramSpec = paramSpecs[i];
                let paramValue = params[paramSpec.name];
                text += paramSpec.stringfier(paramValue, values) + textParts[i + 1];
            }
            this.name = name;
            this.text = text;
            this.values = values.length ? values : undefined;
            if (options) {
                this.mask = options.mask;
                this.mode = options.mode;
                this.handler = options.handler;
            }
        }
    };
}
function buildParamSpec(paramMatch) {
    let spec;
    let info = SINGLE_PARAM_PATTERN.exec(paramMatch);
    if (info) {
        let pname = info[1];
        if (pname.charAt(0) === '~') {
            spec = { name: pname.substr(1), stringfier: stringifyRawSingleParam };
        }
        else {
            spec = { name: pname, stringfier: stringifySingleParam };
        }
    }
    else {
        info = ARRAY_PARAM_PATTERN.exec(paramMatch);
        let pname = info[1];
        if (pname.charAt(0) === '~') {
            spec = { name: pname.substr(1), stringfier: stringifyRawArrayParam };
        }
        else {
            spec = { name: pname, stringfier: stringifyArrayParam };
        }
    }
    return spec;
}
function stringifyRawSingleParam(value, values) {
    if (value === undefined || value === null)
        return 'null';
    const valueType = typeof value;
    if (valueType === 'string') {
        return value;
    }
    else if (valueType === 'number') {
        return value.toString();
    }
    else {
        throw new Error(`Raw query parameter cannot be ${valueType} value`);
    }
}
function stringifySingleParam(value, values) {
    if (value === undefined || value === null)
        return 'null';
    switch (typeof value) {
        case 'number':
        case 'boolean': {
            return value.toString();
        }
        case 'string': {
            return isSafeString(value) ? '\'' + value + '\'' : '$' + values.push(value);
        }
        case 'function': {
            const pvalue = value.valueOf();
            if (typeof pvalue === 'function') {
                throw new Error('Query parameter cannot be a function');
            }
            return stringifySingleParam(pvalue, values);
        }
        default: {
            if (value instanceof Date) {
                return '\'' + value.toISOString() + '\'';
            }
            else if (value instanceof Buffer) {
                return '\'' + value.toString('base64') + '\'';
            }
            else {
                const pvalue = value.valueOf();
                if (typeof pvalue === 'object') {
                    const svalue = JSON.stringify(pvalue);
                    return isSafeString(svalue) ? '\'' + svalue + '\'' : '$' + values.push(svalue);
                }
                else {
                    return stringifySingleParam(pvalue, values);
                }
            }
        }
    }
}
function stringifyRawArrayParam(array, values) {
    if (array === undefined || array === null || array.length === 0)
        return 'null';
    const paramValues = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null)
            continue;
        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Query parameter cannot be an array of mixed values');
        if (valueType === 'string') {
            paramValues.push(value);
        }
        else if (valueType === 'number') {
            paramValues.push(value.toString());
        }
        else {
            throw new Error(`Query parameter array cannot contain ${valueType} values`);
        }
    }
    return paramValues.join(',');
}
function stringifyArrayParam(array, values) {
    if (array === undefined || array === null || array.length === 0)
        return 'null';
    const paramValues = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null)
            continue;
        let valueType = typeof value;
        if (valueType !== arrayType)
            throw new Error('Query parameter cannot be an array of mixed values');
        if (valueType === 'string') {
            if (isSafeString(value)) {
                paramValues.push('\'' + value + '\'');
            }
            else {
                paramValues.push('$' + values.push(value));
            }
        }
        else if (valueType === 'number') {
            paramValues.push(value.toString());
        }
        else {
            throw new Error(`Query parameter array cannot contain ${valueType} values`);
        }
    }
    return paramValues.join(',');
}
function isSafeString(value) {
    return (!value.includes('\'') && !value.includes(`\\`));
}
function validateQueryArguments(text, nameOrOptions, options) {
    if (typeof text !== 'string')
        throw new TypeError('Query text must be a string');
    let qText = text.trim();
    if (qText === '')
        throw new TypeError('Query text cannot be an empty string');
    qText += (qText.charAt(qText.length - 1) !== ';') ? ';\n' : '\n';
    let qName, qOptions;
    if (typeof nameOrOptions === 'string') {
        qName = nameOrOptions.trim();
        if (typeof qName !== 'string' || !qName)
            throw new TypeError('Query name must be a non-empty string');
        if (options) {
            qOptions = validateQueryOptions(options);
        }
    }
    else if (typeof nameOrOptions === 'object') {
        qName = 'anonymous query';
        qOptions = validateQueryOptions(nameOrOptions);
    }
    return { text: qText, name: qName, options: qOptions };
}
function validateQueryOptions({ mask, mode, handler }) {
    if (mask !== 'list' && mask !== 'single')
        throw new TypeError(`Query mask '${mask}' is invalid`);
    if (mode) {
        if (mode !== 'object' && mode !== 'array')
            throw new TypeError(`Query mode '${mask}' is invalid`);
    }
    else {
        mode = 'object';
    }
    if (handler) {
        if (typeof handler !== 'object')
            throw new TypeError('Query handler is invalid');
        if (typeof handler.parse !== 'function')
            throw new TypeError('Query handler parser is invalid');
    }
    return { mask, mode, handler };
}
function formatQueryText(text) {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return text;
}
//# sourceMappingURL=Query.js.map