export function since(start: number[]) {
    var diff = process.hrtime(start);
    return (diff[0] * 1000 + diff[1] / 1000000);
}