'use strict';

module.exports = () => function * (next) {
    try {
        yield next;
    } catch (err) {
        // If there error shouldn't be exposed, output a 500 error
        if (!err.expose) {
            this.body = { code: 'INTERNAL', message: 'Internal server error' };
            this.status = 500;
        // Normal exposed error
        } else {
            this.body = { code: err.code || 'UNSPECIFIED', message: err.message };
            this.status = err.status || 500;
        }

        // Emit the error so that it can be logged
        this.app.emit('error', err, this);
    }
};
