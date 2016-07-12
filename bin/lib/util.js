"use strict";
function since(start) {
    const diff = process.hrtime(start);
    return diff[0] * 1000 + Math.floor(diff[1] / 100000) / 10;
}
exports.since = since;
//# sourceMappingURL=util.js.map