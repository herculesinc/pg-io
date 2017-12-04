"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// NAMESPACE
// ================================================================================================
var PgQuery;
(function (PgQuery) {
    function fromQuery(source, resolve, reject) {
        return {
            text: '',
            rowMode: source.mode === 'array' ? 'array' : undefined,
            values: [],
            sources: [{
                    query: source,
                    resolve: resolve,
                    reject: reject
                }]
        };
    }
    PgQuery.fromQuery = fromQuery;
    function merge(query, source, resolve, reject) {
        query.text += '';
        query.sources.push({
            query: source,
            resolve: resolve,
            reject: reject
        });
        return query;
    }
    PgQuery.merge = merge;
    function x(query, results) {
        const expectedResultCount = query.sources.length;
        if (expectedResultCount === 1) {
            if (Array.isArray(results))
                throw Error(); // TODO
            return [results.rows];
        }
        else {
            if (!Array.isArray(results))
                throw Error(); // TODO
            if (results.length !== expectedResultCount)
                throw Error(); // TODO
            const retval = [];
            for (let i = 0; i < expectedResultCount; i++) {
                let result = results[i];
                let source = query.sources[i];
                retval.push(result.rows);
            }
        }
    }
    PgQuery.x = x;
})(PgQuery = exports.PgQuery || (exports.PgQuery = {}));
//# sourceMappingURL=PgQuery.js.map