'use strict';

require('./lib/configure');

const koa = require('koa');
const koaPino = require('koa-pino-logger');
const responseTime = require('koa-response-time');
const gaPageview = require('koa-ga-pageview');
const error = require('./lib/middleware/error');
const notFound = require('./lib/middleware/not-found');
const routes = require('./lib/routes');

module.exports = (config, npmsNano, esClient) => {
    const app = koa();
    const log = logger.child({ module: 'index' });

    // Middleware
    app.use(responseTime());
    app.use(error());
    app.use(notFound());
    app.use(koaPino({ name: 'npms-api', level: logger.level, serializers: logger.serializers }));
    config.googleAnalyticsId && app.use(gaPageview(config.googleAnalyticsId, '_ga'));

    // Routes
    app.use(routes(npmsNano, esClient));

    // Log errors
    app.on('error', (err) => log.error({ err }, err.message));

    return app;
};
