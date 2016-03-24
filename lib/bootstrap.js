'use strict';
const config = require('config');
const koa = require('koa');
const route = require('koa-route');
const responseTime = require('koa-response-time');
const logger = require('koa-logger');
const ElasticSearch = require('elasticsearch');
const Search = require('./search');

const env = process.env.NODE_ENV || 'development';

module.exports = () => {
    const app = koa();

    // logger ?
    if (env !== 'test') {
        app.use(logger());
    }

    // x-response-time
    app.use(responseTime());


    // controller dependencies
    const elasticClient = new ElasticSearch.Client({}); // TODO config
    const search = new Search(elasticClient);

    // routes
    app.use(route.get('/search/', require('./controllers/search.js')(search)));

    return app;
};
