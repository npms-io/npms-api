'use strict';
const koa = require('koa');
const responseTime = require('koa-response-time');
const logger = require('koa-logger');
const fs = require('fs');
const cors = require('kcors');
const router = require('koa-joi-router')();
const container = require('./container');

const env = process.env.NODE_ENV || 'development';

module.exports = () => {
    const app = koa();
    app.use(cors());

    // logger ?
    if (env !== 'test') {
        app.use(logger());
    }

    // x-response-time
    app.use(responseTime());

    // error handling
    app.use(function * (next) {
        try {
            yield next;
        } catch (err) {
            this.status = err.status || 500;
            this.body = { message: err.message };
            this.app.emit('error', err, this);
        }
    });

    // routes

    /* eslint global-require: 0 */
    fs.readdirSync('./lib/controllers').forEach((file) => {
        require(`./controllers/${file}`).builder(router, container);
    });

    app.use(router.middleware());

    return app;
};
