'use strict';

const router = require('koa-router');
const routes = require('require-directory')(module);

module.exports = (npmsNano, esClient) => {
    const apiRouter = router();

    routes.module.info(apiRouter, npmsNano, esClient);
    routes.search.query(apiRouter, esClient);
    routes.search.autocomplete(apiRouter, esClient);

    return apiRouter.routes();
};
