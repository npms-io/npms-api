const _ = require('lodash');

function calculateError(expectations, results) {
    const error = _.reduce(expectations, (total, expectation, packageName) => {
        const index = results.indexOf(packageName);

        return total + index !== -1 ? Math.abs(expectation - results.indexOf(packageName)) : Math.pow(10, 9);
    }, 0);

    return error - calculateMinError(expectations);
}

function calculateMinError(expectations) {
    const counts = {};

    _.values(expectations).forEach((index) => {
        counts[index] = counts[index] !== undefined ? counts[index] + 1 : 0;
    });

    return _.reduce(counts, (total, count, index) => {
        const backCount = Math.min(Math.floor(count / 2), index);
        const backwards = _.range(1, backCount + 1);
        const forwards = _.range(1, (count - backCount) + 1);

        return total + _(backwards).concat(forwards).sum();
    }, 0);
}

module.exports = calculateError;
