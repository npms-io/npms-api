'use strict';
// TODO

const builder = (router, container) => {
    router.route({
        method: 'get',
        path: '/info',
        handler: handler()
    });

    return router;
};

const handler = () => function * () {
    this.body = 'Info';
};

module.exports = builder;
