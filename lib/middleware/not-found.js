'use strict';

module.exports = () => function * (next) {
    yield next;

    if (this.status === 404 && !this.body) {
        this.body = { code: 'NOT_FOUND', message: 'The specified endpoint does not exist' };
        this.status = 404;
    }
};
