'use strict';
const Joi = require('koa-joi-router').Joi;

const builder = (router, container) => {
    router.route({
        method: 'get',
        path: '/search',
        validate: {
            query: {
                q: Joi.string().min(3).max(255).required(),
                from: Joi.number().min(0),
                size: Joi.number().min(0),
                effect: Joi.number().min(0),
                weightQuality: Joi.number().min(0),
                weightPopularity: Joi.number().min(0),
                weightMaintenance: Joi.number().min(0),
            },
        },
        handler: handler(container.search)
    });

    return router;
};

const handler = (search) => function * () {
    const result = yield search.get(
        this.request.query.q,
        this.request.query.from,
        this.request.query.size,
        this.request.query.effect,
        {
            quality: this.request.query.weightQuality,
            popularity: this.request.query.weightPopularity,
            maintenance: this.request.query.weightMaintenance,
        }
    );

    // TODO: Change Structure
    this.body = {
        results: result.hits.hits.map((hit) => {
            return {
                name: hit._id,
                description: hit._source.description,
                keywords: (hit._source.keywords || []).join('; '),
                score: hit._score,
                analysisScore: Object.assign({final: hit._source.score.final}, hit._source.score.detail),
            }
        })
    };
};

module.exports = builder;
