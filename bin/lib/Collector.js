'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _Query = require('./Query');

// CLASS DEFINITION
// ================================================================================================

class Collector {
    constructor(queries) {
        this.results = new Map();
        this.singleResult = true;
        for (let query of queries) {
            if ((0, _Query.isResultQuery)(query)) {
                if (this.results.has(query.name)) {
                    if (this.results.get(query.name) === undefined) {
                        this.results.set(query.name, []);
                        this.singleResult = false;
                    }
                } else {
                    this.results.set(query.name, undefined);
                }
            }
        }
    }
    addResult(query, result) {
        if (result === undefined || this.results.has(query.name) === false) return;
        if ((0, _Query.isResultQuery)(query)) {
            if (query.mask === 'object') {
                result = result ? result[0] : undefined;
                if (result === undefined) return undefined;
            }
            var queryResults = this.results.get(query.name);
            if (queryResults) {
                queryResults.push(result);
            } else {
                this.results.set(query.name, result);
            }
        }
    }
    getResults() {
        if (this.results.size === 0) {
            return undefined;
        } else if (this.results.size === 1 && this.singleResult) {
            return this.results.values().next().value;
        } else {
            return this.results;
        }
    }
}

exports.default = Collector;
module.exports = exports.default;
//# sourceMappingURL=../../bin/lib/Collector.js.map