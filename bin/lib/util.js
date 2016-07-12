"use strict";
function since(start) {
    var diff = process.hrtime(start);
    return Math.floor(diff[0] * 10000 + diff[1] / 100000) / 10;
}
exports.since = since;
//# sourceMappingURL=util.js.map