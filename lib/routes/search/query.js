'use strict';

const Joi = require('joi');
const normalizeNumber = require('normalize-number');
const pick = require('lodash/pick');
const joiValidate = require('../../util/joiValidate');

const scoreScript = '(doc["score.detail.popularity"].value * popularityWeight + ' +
    'doc["score.detail.quality"].value * qualityWeight + ' +
    'doc["score.detail.maintenance"].value * maintenanceWeight)';
const finalScript = `(doc["module.name.raw"].value.equals(term)) ? 100000 + ${scoreScript} : _score * pow(${scoreScript}, scoreEffect)`;

function fetchResults(params, esClient) {
    /* eslint camelcase: 0 */
    return esClient.search({
        index: 'npms-read',
        body: {
            size: params.size,
            from: params.from,
            query: {
                function_score: {
                    boost_mode: 'replace',
                    query: {
                        bool: {
                            should: [
                                // Prefix matches using edge-ngram
                                {
                                    multi_match: {
                                        query: params.term,
                                        operator: 'and',
                                        fields: [
                                            'module.name.identifier_edge_ngram^4',
                                            'module.description.identifier_edge_ngram',
                                            'module.keywords.identifier_edge_ngram^2',
                                        ],
                                        analyzer: 'identifier',
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
                                            'module.name.identifier_english_docs^4',
                                            'module.description.identifier_english_docs',
                                            'module.keywords.identifier_english_docs^2',
                                        ],
                                        analyzer: 'identifier_english',
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
                                            'module.name.identifier_english_aggressive_docs^4',
                                            'module.description.identifier_english_aggressive_docs',
                                            'module.keywords.identifier_english_aggressive_docs^2',
                                        ],
                                        analyzer: 'identifier_english_aggressive',
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
    })
    .then((result) => ({
        total: result.hits.total,
        results: result.hits.hits.map((hit) => Object.assign(hit._source, { searchScore: hit._score })),
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
    const querySchema = Joi.object({
        term: Joi.string().min(1).max(255).trim().lowercase().required(),
        from: Joi.number().min(0).default(0),
        size: Joi.number().min(0).default(25),
        scoreEffect: Joi.number().min(0).max(25).default(15.3),
        qualityWeight: Joi.number().min(0).max(100).default(0.27),
        popularityWeight: Joi.number().min(0).max(100).default(0.45),
        maintenanceWeight: Joi.number().min(0).max(100).default(0.28),
    }).required();

    router.get('/search', function * () {
        const params = joiValidate(querySchema, this.request.query);

        this.log.debug({ params }, 'Validated search params');

        // Normalize weights so that they are between 0 and 1
        normalizeWeights(params);

        this.log.debug({ params }, 'Weights were normalized, will now search');

        // Finally search in elasticsearch
        this.body = yield fetchResults(params, esClient);
    });
};
