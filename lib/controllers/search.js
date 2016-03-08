'use strict';

module.exports = function * () {
    this.body = yield Promise.delay(100).returna('hello world');
};
