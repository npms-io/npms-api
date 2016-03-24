'use strict';
// TODO

const builder = (router) => {
    router.route({
        method: 'get',
        path: '/info',
        handler: handler(),
    });

    return router;
};

const handler = () => function * () {
    this.body = ['the', 'info', 'will', 'be', 'provided', 'soon'];
};

module.exports = builder;
