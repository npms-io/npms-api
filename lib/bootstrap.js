'use strict';
const koa = require('koa');
const route = require('koa-route');
const responseTime = require('koa-response-time');
const compress = require('koa-compress');
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

    // gzip
    app.use(compress());

    // routes
    // TODO: This should be automatic. Maybe based on Swagger data
    app.use(route.get('/', require('./controllers/search.js')));

    return app;
};
