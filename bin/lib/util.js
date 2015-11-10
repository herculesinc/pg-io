"use strict";

function since(start) {
    var diff = process.hrtime(start);
    return diff[0] * 1000 + diff[1] / 1000000;
}
exports.since = since;
//# sourceMappingURL=../../bin/lib/util.js.map