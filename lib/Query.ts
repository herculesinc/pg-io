// IMPORTS
// ================================================================================================
import { QueryError } from './errors';

// MODULE VARIABLES
// ================================================================================================
const PARAM_PATTERN = /{{([a-z0-9\$_]+)}}/gi;
const ARRAY_PARAM_PATTERN = /\[\[([a-z0-9\$_]+)\]\]/gi;

// INTERFACES
// ================================================================================================
export type QueryMask = 'list' | 'object';

export interface ResultHandler<T> {
    parse(row: any): T;
}

export interface QuerySpec {
    text    : string;
    name?   : string;
}

export interface Query extends QuerySpec {
    params? : any;
}

export interface ResultQuery<T> extends Query {
    mask    : QueryMask;
    handler?: ResultHandler<T>;
}

export interface SingleResultQuery<T> extends Query {
    mask    : 'object';
    handler?: ResultHandler<T>;
}

export interface ListResultQuery<T> extends Query {
    mask    : 'list';
    handler?: ResultHandler<T>;
}

export interface DbQuery {
    text        : string;
    values?     : any[];
    multiResult?: boolean;
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function Query(spec: QuerySpec, params?: any): Query
export function Query<T>(spec: QuerySpec, params?: any, mask?: 'list'): ListResultQuery<T>
export function Query<T>(spec: QuerySpec, params?: any, mask?: 'object'): SingleResultQuery<T>
export function Query(spec: QuerySpec, params?: any, mask?: QueryMask): Query | ResultQuery<any> {
    if (!spec) return undefined;
    
    if (mask && (mask !== 'list' || 'object')) {
        throw new QueryError(`Invalid query mask: value '${mask}' is not supported`);
    }

    return {
        name    : spec.name,
        text    : spec.text,
        params  : params,
        mask    : mask
    };
}

export function isResultQuery(query: Query): query is ResultQuery<any> {
    const queryMask = query['mask'];
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
        const params = [];
        let text = query.text.replace(PARAM_PATTERN, function (match, paramName) {
            const param = query.params[paramName];
            return stringifySingleParam(param, params);
        });
        
        text = text.replace(ARRAY_PARAM_PATTERN, function (match, paramName) {
            const param = query.params[paramName];
            if (param && !Array.isArray(param))
                throw new QueryError('Invalid query: non-array supplied for array parameter');
            return stringifyArrayParam(param, params);
        });
        
        return {
            text    : formatQueryText(text),
            values  : params.length > 0 ? params : undefined,
        };
    }
    else {
        return {
            text    : formatQueryText(query.text)
        };
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
            let paramValue = value.valueOf();
            if (typeof paramValue === 'function') {
                throw new QueryError('Query parameter cannot be a function');
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

function stringifyArrayParam(values: any[], params: any[]): string {
    if (values == undefined || values.length === 0) return 'null';
    
    const paramValues: string[] = [];
    const arrayType = typeof values[0];
    for (let value of values) {
        if (value == undefined) continue;
        
        let valueType = typeof value;
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
    return (!value.includes('\'') && !value.includes(`\\`));
}

function formatQueryText(text: string): string {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return  text;
}