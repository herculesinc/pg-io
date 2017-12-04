// IMPORTS
// ================================================================================================
import { QueryConfig, QueryResult } from 'pg';
import { Query, QueryMask } from './Query';

// INTERFACES
// ================================================================================================
interface Resolver { (result: any): void; }
interface Rejector { (reason: any): void; }

export interface PgQuery extends QueryConfig {
    readonly sources    : QuerySource[];
}

export interface QuerySource {
    readonly query      : Query<any>;
    readonly resolve    : Resolver;
    readonly reject     : Rejector;
    rows?               : any[];
}

// NAMESPACE
// ================================================================================================
export namespace PgQuery {

    export function fromQuery(source: Query<any>, resolve: Resolver, reject: Rejector): PgQuery {

        return {
            text    : '',
            rowMode : source.mode === 'array' ? 'array' : undefined,
            values  : [],
            sources : [{
                query   : source,
                resolve : resolve,
                reject  : reject
            }]
        };
    }

    export function merge(query: PgQuery, source: Query<any>, resolve: Resolver, reject: Rejector): PgQuery {

        query.text += '';
        query.sources.push({
            query   : source,
            resolve : resolve,
            reject  : reject
        });

        return query;
    }

    export function x(query: PgQuery, results: QueryResult | QueryResult[]) {
        const expectedResultCount = query.sources.length;

        if (expectedResultCount === 1) {
            if (Array.isArray(results)) throw Error(); // TODO
            return [results.rows];
        }
        else {
            if (!Array.isArray(results)) throw Error(); // TODO
            if (results.length !== expectedResultCount) throw Error(); // TODO

            const retval = [];
            for (let i = 0; i < expectedResultCount; i++) {
                let result = results[i];
                let source = query.sources[i];

                retval.push(result.rows);
            }
        }
    }
}