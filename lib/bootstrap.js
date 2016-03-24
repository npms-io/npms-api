'use strict';
const koa = require('koa');
const route = require('koa-route');
const responseTime = require('koa-response-time');
const logger = require('koa-logger');

const env = process.env.NODE_ENV || 'development';

module.exports = () => {
    const app = koa();

    // logger ?
    if (env !== 'test') {
        app.use(logger());
    }

    // x-response-time
    app.use(responseTime());

    // error handling
    app.use(function *(next) {
        try {
            yield next;
        } catch (err) {
            this.status = err.status || 500;
            this.body = { message: err.message };
            this.app.emit('error', err, this);
        }
    });

    // routes
    app.use(require('./routes'));

    return app;
};
