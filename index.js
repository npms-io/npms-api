'use strict';

require('./lib/configure');

const koa = require('koa');
const koaPino = require('koa-pino-logger');
const responseTime = require('koa-response-time');
const error = require('./lib/middleware/error');
const notFound = require('./lib/middleware/not-found');
const routes = require('./lib/routes');

const log = logger.child({ module: 'index' });

module.exports = (npmsNano, esClient) => {
    const app = koa();

    // Middleware
    app.use(responseTime());
    app.use(error());
    app.use(notFound());
    app.use(koaPino({ name: 'npms-api', level: logger.level, serializers: logger.serializers }));

    // Routes
    app.use(routes(npmsNano, esClient));

    // Log errors
    app.on('error', (err) => log.error({ err }, err.message));

    return app;
};
