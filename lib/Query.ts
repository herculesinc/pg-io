// IMPORTS
// ================================================================================================
import { PgError } from './errors';

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

// PUBLIC FUNCTIONS
// ================================================================================================
export function isResultQuery(query: Query): query is ResultQuery<any> {
    return ('mask' in query);
}

export function isParametrized(query: Query | DbQuery): boolean {
    return  ('values' in query || 'params' in query);
}

export function toDbQuery(query: Query): DbQuery {
    validateQuery(query);
    
    if (query.params) {
        var params = [];
        var text = query.text.replace(paramPattern, function (match, paramName) {
            var { paramValue, isSafe } = processParam(query.params[paramName]);
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

// HELPER FUNCTIONS
// ================================================================================================
function validateQuery(query: Query) {
    if (query.text === undefined || query.text === null || query.text.trim() === '')
        throw new PgError('Invalid query: query text cannot be empty');
}

function processParam(value: any) {
    var isSafe = true;
    var paramValue: string;
    
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
                paramValue = isSafe ? `'${value}'` : value;
                break;
            case 'function':
                throw new Error('Query parameter cannot be a function');
            default:
                if (value instanceof Date) {
                    paramValue = `'${value.toISOString()}'`;
                }
                if (value instanceof Array) {
                    // TODO: implement array parametrizaton
                    throw new Error('Query parameter cannot be an array');
                }
                paramValue = JSON.stringify(value);
                isSafe = isSafeString(paramValue);
                paramValue = isSafe ? `'${paramValue}'` : paramValue;
        }
    }
    
    return  { paramValue, isSafe };
}

function isSafeString(value: string): boolean {
    return  (value.indexOf('\'') === -1 && value.indexOf(`\\`) === -1);
}

function formatQueryText(text: string): string {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return  text;
}