var Query_1 = require('./Query');
// CLASS DEFINITION
// ================================================================================================
var Collector = (function () {
    function Collector(queries) {
        this.results = new Map();
        this.singleResult = true;
        for (var _i = 0; _i < queries.length; _i++) {
            var query = queries[_i];
            if (Query_1.isResultQuery(query)) {
                if (this.results.has(query.name)) {
                    if (this.results.get(query.name) === undefined) {
                        this.results.set(query.name, []);
                        this.singleResult = false;
                    }
                }
                else {
                    this.results.set(query.name, undefined);
                }
            }
        }
    }
    Collector.prototype.addResult = function (query, result) {
        if (result === undefined || this.results.has(query.name) === false)
            return;
        if (Query_1.isResultQuery(query)) {
            if (query.mask === 'object') {
                result = result ? result[0] : undefined;
                if (result === undefined)
                    return undefined;
            }
            var queryResults = this.results.get(query.name);
            if (queryResults) {
                queryResults.push(result);
            }
            else {
                this.results.set(query.name, result);
            }
        }
    };
    Collector.prototype.getResults = function () {
        if (this.results.size === 0) {
            return undefined;
        }
        else if (this.results.size === 1 && this.singleResult) {
            return this.results.values().next().value;
        }
        else {
            return this.results;
        }
    };
    return Collector;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Collector;
//# sourceMappingURL=Collector.js.map