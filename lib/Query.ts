// IMPORTS
// ================================================================================================
import { QueryError } from './errors';

// MODULE VARIABLES
// ================================================================================================
const SINGLE_PARAM_PATTERN = /{{(~?[a-z0-9_]+)}}/i;
const ARRAY_PARAM_PATTERN = /\[\[(~?[a-z0-9_]+)\]\]/i;
const PARAM_PATTERN = /{{~?[a-z0-9_]+}}|\[\[~?[a-z0-9_]+\]\]/gi;

// INTERFACES
// ================================================================================================
export type QueryMask = 'list' | 'single';
export type QueryMode = 'object' | 'array';

export interface ResultHandler<T> {
    parse(row: any): T;
}

export interface Query<T> {
    readonly text       : string;
    readonly name?      : string;
    readonly mode?      : QueryMode;
    readonly mask?      : QueryMask;
    readonly values?    : any[];
    readonly handler?   : ResultHandler<T>;
}

export interface ResultQuery<T> extends Query<T> {
    readonly mask       : QueryMask;
    readonly mode?      : QueryMode;
    readonly handler?   : ResultHandler<T>;
}

export interface SingleResultQuery<T> extends ResultQuery<T> {
    readonly mask       : 'single';
}

export interface ListResultQuery<T> extends ResultQuery<T> {
    readonly mask       : 'list';
}

export interface ResultQueryOptions<T> {
    readonly mask       : QueryMask;
    readonly mode?      : QueryMode;
    readonly handler?   : ResultHandler<T>;
}

export interface SingleResultQueryOptions<T> extends ResultQueryOptions<T> {
    readonly mask       : 'single';
    readonly mode?      : QueryMode;
    readonly handler?   : ResultHandler<T>;
}

export interface ListResultQueryOptions<T> extends ResultQueryOptions<T> {
    readonly mask       : 'list';
    readonly mode?      : QueryMode;
    readonly handler?   : ResultHandler<T>;
}

export interface QueryTemplate<T extends Query<any>> {
    new(params: object): T;
}

interface ParamSpec {
    name                : string;
    stringfier          : (value: any, values: string[]) => string;
}

export interface PgQuery {
    readonly text       : string;
    readonly rowMode?   : 'array';
    readonly values?    : any[];
    source?: {
        query           : Query<any>;
        resolve         : (result: any) => void;
        reject          : (reason: any) => void;
    }[];
}

// QUERY NAMESPACE
// ================================================================================================
export namespace Query {

    export function from(text: string): Query<void>
    export function from(text: string, name: string): Query<void>
    export function from<T>(text: string, options?: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T>(text: string, name: string, options?: ListResultQueryOptions<T>): ListResultQuery<T>
    export function from<T>(text: string, options?: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T>(text: string, name: string, options?: SingleResultQueryOptions<T>): SingleResultQuery<T>
    export function from<T>(text: string, nameOrOptions?: string | ResultQueryOptions<T>, options?: ResultQueryOptions<T>): Query<any> {
        const validated = validateQueryArguments(text, nameOrOptions, options);
        if (validated.options) {
            return {
                text    : validated.text,
                name    : validated.name,
                mask    : validated.options.mask,
                mode    : validated.options.mode,
                handler : validated.options.handler
            };
        }
        else {
            return {
                text    : validated.text,
                name    : validated.name
            };
        }
    }

    export function template(text: string): QueryTemplate<Query<void>>
    export function template(text: string, name: string): QueryTemplate<Query<void>>
    export function template<T>(text: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T>(text: string, name: string, options?: ListResultQueryOptions<T>): QueryTemplate<ListResultQuery<T>>
    export function template<T>(text: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T>(text: string, name: string, options?: SingleResultQueryOptions<T>): QueryTemplate<SingleResultQuery<T>>
    export function template<T>(text: string, nameOrOptions?: string | ResultQueryOptions<T>, options?: ResultQueryOptions<T>): QueryTemplate<any> {

        const validated = validateQueryArguments(text, nameOrOptions, options);
        const textParts = validated.text.split(PARAM_PATTERN);
        if (textParts.length < 2) throw new Error('Query text must contain at least one parameter');
        
        const paramMatches = text.match(PARAM_PATTERN);
        const paramSpecs: ParamSpec[] = [];
        for (let match of paramMatches) {
            paramSpecs.push(buildParamSpec(match));
        }

        return buildQueryTemplate(validated.name, textParts, paramSpecs, validated.options);
    }
}

// PUBLIC FUNCTIONS
// ================================================================================================
export function toPgQuery(query: Query<any>): PgQuery {
    if (query == undefined || query.text == undefined || query.text.trim() === '')
        throw new QueryError('Invalid query: query text cannot be empty');
    
    if (query.values) {
        const params = [];
        let text = query.text.replace(PARAM_PATTERN, function (match, paramName) {
            const param = query.values[paramName];
            return stringifySingleParam(param, params);
        });
        
        text = text.replace(ARRAY_PARAM_PATTERN, function (match, paramName) {
            const param = query.values[paramName];
            if (param && !Array.isArray(param))
                throw new QueryError('Invalid query: non-array supplied for array parameter');
            return stringifyArrayParam(param, params);
        });
        
        return {
            text    : formatQueryText(text),
            rowMode : query.mode === 'array' ? 'array' : undefined,
            values  : params.length > 0 ? params : undefined,
        };
    }
    else {
        return {
            text    : formatQueryText(query.text),
            rowMode : query.mode === 'array' ? 'array' : undefined
        };
    }
}

export function isResultQuery(query: Query<any>): query is ResultQuery<any> {
    const queryMask = query.mask;
    if (queryMask === 'single' || queryMask === 'list') {
        return true;
    }
    else if (queryMask) {
        throw new QueryError(`Invalid query mask: value '${queryMask}' is not supported`);
    }
    else {
        return false;
    }
}

// HELPER FUNCTIONS
// ================================================================================================
function buildQueryTemplate<T>(name: string, textParts: string[], paramSpecs: ParamSpec[], options?: ResultQueryOptions<T>): QueryTemplate<any> {

    return class ParametrizedQuery implements Query<T> {

        readonly name       : string;
        readonly mode?      : QueryMode;
        readonly mask?      : QueryMask;
        readonly text       : string;
        readonly values?    : any[];
        readonly handler?   : ResultHandler<T>;

        constructor(params: object) {            
            if (!params) throw new TypeError('Query params are undefined');
            if (typeof params !== 'object') throw new TypeError('Query params must be an object');

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

function buildParamSpec(paramMatch: string): ParamSpec {
    let spec: ParamSpec;

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

function stringifyRawSingleParam(value: any, values: string[]) {
    if (value === undefined || value === null) return 'null';

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

function stringifySingleParam(value: any, values: string[]): string {
    if (value === undefined || value === null) return 'null';
    
    switch (typeof value) {
        case 'number': case 'boolean': {
            return value.toString();
        }
        case 'string':{
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

function stringifyRawArrayParam(array: any[], values: string[]): string {
    if (array === undefined || array === null || array.length === 0) return 'null';
    
    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;
        
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

function stringifyArrayParam(array: any[], values: string[]): string {
    if (array === undefined || array === null || array.length === 0) return 'null';
    
    const paramValues: string[] = [];
    const arrayType = typeof array[0];
    for (let value of array) {
        if (value === undefined || value === null) continue;
        
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

function isSafeString(value: string): boolean {
    return (!value.includes('\'') && !value.includes(`\\`));
}

function validateQueryArguments(text: string, nameOrOptions?: string | ResultQueryOptions<any>, options?: ResultQueryOptions<any>) {
    if (typeof text !== 'string') throw new TypeError('Query text must be a string');
    let qText = text.trim();
    if (qText === '') throw new TypeError('Query text cannot be an empty string');
    qText += (qText.charAt(qText.length - 1) !== ';') ? ';\n' : '\n';
    
    let qName: string, qOptions: ResultQueryOptions<any>;
    if (typeof nameOrOptions === 'string') {
        qName = nameOrOptions.trim();
        if (typeof qName !== 'string' || !qName) throw new TypeError('Query name must be a non-empty string');
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

function validateQueryOptions({ mask, mode, handler}: ResultQueryOptions<any>) {
    if (mask !== 'list' && mask !== 'single') throw new TypeError(`Query mask '${mask}' is invalid`);
    
    if (mode) {
        if (mode !== 'object' && mode !== 'array') throw new TypeError(`Query mode '${mask}' is invalid`);
    }
    else {
        mode = 'object';
    }

    if (handler) {
        if (typeof handler !== 'object') throw new TypeError('Query handler is invalid');
        if (typeof handler.parse !== 'function') throw new TypeError('Query handler parser is invalid');
    }

    return { mask, mode, handler };
}

function formatQueryText(text: string): string {
    text = text.trim();
    text += (text.charAt(text.length - 1) !== ';') ? ';\n' : '\n';
    return  text;
}