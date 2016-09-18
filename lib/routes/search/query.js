'use strict';

const Joi = require('joi');
const normalizeNumber = require('normalize-number');
const pick = require('lodash/pick');
const validateJoiSchema = require('../../util/validateJoiSchema');

const fields = ['module', 'score'];
const scoreScript = '(doc["score.detail.popularity"].value * popularityWeight + ' +
    'doc["score.detail.quality"].value * qualityWeight + ' +
    'doc["score.detail.maintenance"].value * maintenanceWeight)';
const finalScript = `doc["module.name.raw"].value.equals(term) ? 100000 + ${scoreScript} : _score * pow(${scoreScript}, scoreEffect)`;

function fetchResults(params, esClient) {
    /* eslint camelcase: 0 */

    // Need to use Promise.resolve because elasticsearch does not use native Promise
    return Promise.resolve(esClient.search({
        index: 'npms-current',
        body: {
            size: params.size,
            from: params.from,
            query: {
                function_score: {
                    boost_mode: 'replace',
                    query: {
                        bool: {
                            should: [
                                // Partial match using edge-ngram
                                {
                                    multi_match: {
                                        query: params.term,
                                        operator: 'and',
                                        fields: [
                                            'module.name.edge_ngram^4',
                                            'module.description.edge_ngram',
                                            'module.keywords.edge_ngram^2',
                                        ],
                                        type: 'phrase',
                                        slop: 3,
                                        boost: 3,
                                    },
                                },

                                // Normal term match with an english stemmer
                                {
                                    multi_match: {
                                        query: params.term,
                                        operator: 'and',
                                        fields: [
                                            'module.name.english_docs^4',
                                            'module.description.english_docs',
                                            'module.keywords.english_docs^2',
                                        ],
                                        type: 'cross_fields',
                                        boost: 3,
                                    },
                                },

                                // Normal term match with a more aggressive english stemmer (not so important)
                                {
                                    multi_match: {
                                        query: params.term,
                                        operator: 'and',
                                        fields: [
                                            'module.name.english_aggressive_docs^4',
                                            'module.description.english_aggressive_docs',
                                            'module.keywords.english_aggressive_docs^2',
                                        ],
                                        type: 'cross_fields',
                                    },
                                },
                            ],
                        },
                    },
                    script_score: {
                        lang: 'groovy',
                        script: finalScript,
                        params: pick(params, 'term', 'scoreEffect', 'qualityWeight', 'popularityWeight', 'maintenanceWeight'),
                    },
                },
            },
        },
    }))
    .then((res) => ({
        total: res.hits.total,
        results: res.hits.hits.map((hit) => {
            // We can't use _fields in the query because the JSON properties order get messed up,
            // see https://github.com/elastic/elasticsearch/issues/17639
            // So we filter the source fields manually with pick.. this is not ideal since there's payload
            // navigating through the network that we do not use, but it's definitively better than having order messed up
            const result = pick(hit._source, fields);

            result.searchScore = hit._score;

            return result;
        }),
    }));
}

function normalizeWeights(params) {
    const minMax = [0, params.qualityWeight + params.popularityWeight + params.maintenanceWeight];

    params.qualityWeight = normalizeNumber(minMax, params.qualityWeight);
    params.popularityWeight = normalizeNumber(minMax, params.popularityWeight);
    params.maintenanceWeight = normalizeNumber(minMax, params.maintenanceWeight);

    return params;
}

// ----------------------------------------------------------

module.exports = (router, esClient) => {
    /**
     * @api {get} /search Perform a search query
     * @apiName query
     * @apiGroup search
     * @apiVersion 1.0.0
     *
     * @apiParam {string} term                     The search terms
     * @apiParam {string} [from=0]                 The offset in which to start searching from
     * @apiParam {string} [size=25]                The total number of results to return
     * @apiParam {string} [scoreEffect=15.3]       The effect that the module scores have for the final search score
     * @apiParam {string} [qualityWeight=1.95]     The weight that the quality has for the each module score
     * @apiParam {string} [popularityWeight=3.3]   The weight that the popularity has for each module score
     * @apiParam {string} [maintenanceWeight=2.05] The weight that the maintenance has for each module score
     *
     * @apiSuccess (Each result has) {object} module      The module data which contains the name, version and other useful information
     * @apiSuccess (Each result has) {object} score       The module score
     * @apiSuccess (Each result has) {number} searchScore The computed search score (from elasticsearch)
     *
     * @apiSuccessExample {json} Response:
     *     {
     *       "total": 251,
     *       "results": [
     *         {
     *           "module": { "name": "cross-spawn", "version": "4.0.0", ... },
     *           "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *           "searchScore": 0.0021
     *         },
     *         ...
     *       ]
     *     }
     *
     * @apiExample {curl} Example usage:
     *     curl "https://api.npms.io/v1/search?term=cross+spawn"
     */
    const queryQuerySchema = Joi.object({
        term: Joi.string().min(1).max(255).trim().lowercase().required(),
        from: Joi.number().min(0).default(0),
        size: Joi.number().min(1).max(250).default(25),
        scoreEffect: Joi.number().min(0).max(25).default(15.3),
        qualityWeight: Joi.number().min(0).max(100).default(1.95),      // ~0.27
        popularityWeight: Joi.number().min(0).max(100).default(3.3),    // ~0.45
        maintenanceWeight: Joi.number().min(0).max(100).default(2.05),  // ~0.28
    }).required();

    router.get('/search',
        function * (next) {
            this.validated = validateJoiSchema(queryQuerySchema, this.request.query);
            yield next;
        },
        function * () {
            const params = this.validated;

            // Normalize weights so that they are between 0 and 1
            normalizeWeights(params);
            this.log.debug({ params }, 'Weights were normalized, will now search');

            // Finally search in elasticsearch
            this.body = yield fetchResults(params, esClient);
        });
};
