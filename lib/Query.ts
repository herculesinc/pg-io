// IMPORTS
// ================================================================================================
import { QueryError } from './errors';

// INTERFACES
// ================================================================================================
export interface ResultHandler<T> {
    parse(row: any): T;
}

export interface Query {
    text    : string;
    name?   : string;
    params? : any;
}

export interface ResultQuery<T> extends Query {
    mask    : string;
    handler?: ResultHandler<T>;
}

export interface DbQuery {
    text        : string;
    values?     : any[];
    multiResult?: boolean;
}

// MODULE VARIABLES
// ================================================================================================
var paramPattern = /{{([a-z0-9\$_]+)}}/gi;
var arrayParamPatter = /\[\[([a-z0-9\$_]+)\]\]/gi;

// PUBLIC FUNCTIONS
// ================================================================================================
export function isResultQuery(query: Query): query is ResultQuery<any> {
    var queryMask = query['mask'];
    if (queryMask === 'object' || queryMask === 'list') {
        return true;
    }
    else if (queryMask) {
        throw new QueryError(`Invalid query mask: value '${queryMask}' is not supported`);
    }
    else {
        return false;
    }
}

export function isParametrized(query: Query | DbQuery): boolean {
    return  (query['values'] || query['params']);
}

export function toDbQuery(query: Query): DbQuery {
    if (query == undefined || query.text == undefined || query.text.trim() === '')
        throw new QueryError('Invalid query: query text cannot be empty');
    
    if (query.params) {
        var params = [];
        var text = query.text.replace(paramPattern, function (match, paramName) {
            var param = query.params[paramName];
            return stringifySingleParam(param, params);
        });
        
        text = text.replace(arrayParamPatter, function(match, paramName) {
            var param = query.params[paramName];
            if (param && !Array.isArray(param))
                throw new QueryError('Invalid query: non-array supplied for array parameter');
            return stringifyArrayParam(param, params);
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

// HELPER FUNCTIONS
// ================================================================================================
function stringifySingleParam(value: any, params: any[]): string {
    if (value == undefined) return 'null';
    
    switch (typeof value) {
        case 'number': case 'boolean':
            return value.toString();
        case 'string':
            return isSafeString(value) ? `'${value}'` : '$' + params.push(value);
        case 'function':
            throw new QueryError('Query parameter cannot be a function');
        default:
            if (value instanceof Date) {
                return `'${value.toISOString()}'`;
            }
            else {
                var paramValue = value.valueOf();
                if (typeof paramValue === 'object') {
                    paramValue = JSON.stringify(value);
                }
                return stringifySingleParam(paramValue, params);
            }
    }
}

function stringifyArrayParam(values: any[], params: any[]): string {
    if (values == undefined || values.length === 0) return 'null';
    
    var paramValues: string[] = [];
    var arrayType = typeof values[0];
    for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (value == undefined) continue;
        
        var valueType = typeof value;
        if (valueType !== arrayType)
            throw new QueryError('Query parameter cannot be an array of mixed values');
        
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
            throw new QueryError(`Query parameter array cannot contain ${valueType} values`);
        }
    }
    
    return paramValues.join(',');
}

function isSafeString(value: string): boolean {
    return  (value.indexOf('\'') === -1 && value.indexOf(`\\`) === -1);
}

function formatQueryText(text: string): string {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return  text;
}