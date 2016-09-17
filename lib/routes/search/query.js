'use strict';

const Joi = require('joi');
const pick = require('lodash/pick');
const parseQuery = require('../../util/parseQuery');
const validateJoiSchema = require('../../util/validateJoiSchema');

function buildFilterQuery(params) {
    const filters = [];

    if (params.author) {
        filters.push({
            or: [
                { term: { 'module.author.username': params.author } },
                { term: { 'module.author.email': params.author } },
            ],
        });
    }

    if (params.maintainer) {
        filters.push({
            or: [
                { term: { 'module.maintainers.username': params.maintainer } },
                { term: { 'module.maintainers.email': params.maintainer } },
            ],
        });
    }

    if (params.keywords) {
        filters.push({
            terms: { 'module.keywords': params.keywords },
        });
    }

    if (params.exclude) {
        filters.push({
            not: {
                terms: { flags: params.exclude },
            },
        });
    }

    return filters.length ? { and: filters } : null;
}


function buildMatchQuery(params) {
    if (!params.text) {
        return null;
    }

    return [
        // Partial match using edge-ngram
        {
            multi_match: {
                query: params.text,
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
                query: params.text,
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
                query: params.text,
                operator: 'and',
                fields: [
                    'module.name.english_aggressive_docs^4',
                    'module.description.english_aggressive_docs',
                    'module.keywords.english_aggressive_docs^2',
                ],
                type: 'cross_fields',
            },
        },
    ];
}

function buildScriptScore(params) {
    let script = '(doc["score.detail.popularity"].value * popularityWeight + ' +
        'doc["score.detail.quality"].value * qualityWeight + ' +
        'doc["score.detail.maintenance"].value * maintenanceWeight)';

    if (params.boostExact) {
        script = `doc["module.name.raw"].value.equals(text) ? 100000 + ${script} : _score * pow(${script}, scoreEffect)`;
    }

    return {
        lang: 'groovy',
        script,
        params: pick(params, 'text', 'scoreEffect', 'qualityWeight', 'popularityWeight', 'maintenanceWeight'),
    };
}

function fetchResults(params, esClient) {
    /* eslint camelcase: 0 */

    // Need to use Promise.resolve because Elasticsearch does not use native Promise
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
                            filter: buildFilterQuery(params),
                            must: buildMatchQuery(params),
                        },
                    },
                    script_score: buildScriptScore(params),
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
            const result = pick(hit._source, 'module', 'flags', 'score');

            result.searchScore = hit._score;

            return result;
        }),
    }));
}

// ----------------------------------------------------------

module.exports = (router, esClient) => {
    /**
     * @api {get} /search Perform a search query
     * @apiName query
     * @apiGroup search
     *
     * @apiParam {string} q         The query with support for filters and other modifiers
     * @apiParam {string} [from=0]  The offset in which to start searching from
     * @apiParam {string} [size=25] The total number of results to return
     *
     * @apiDescription
     *
     * Besides normal text, `q` supports qualifiers to express filters and other modifiers:
     * - `author:sindresorhus`: Show/filter results in which `sindresorhus` is the author
     * - `maintainer:sindresorhus`: Show/filter results in which `sindresorhus` is qualifier as a maintainer
     * - `keywords:gulpplugin`: Show/filter results that have `gulpplugin` in the keywords (separate multiple keywords with commas)
     * - `exclude:deprecated`: Exclude deprecated packages from the results
     * - `exclude:unstable`: Exclude packages whose version is `< 1.0.0`
     * - `exclude:insecure`: Exclude packages that are insecure or have vulnerable dependencies (as per [nsp](https://nodesecurity.io/))
     * - `boost-exact:false`: Do not boost exact matches, defaults to `true`
     * - `score-effect:14`: Set the effect that module scores have for the final search score, defaults to `15.3`
     * - `quality-weight:1`: Set the weight that quality has for the each module score, defaults to `1.95`
     * - `popularity-weight:1`: Set the weight that popularity has for the each module score, defaults to `3.3`
     * - `maintenance-weight:1`: Set the weight that the quality has for the each module score, defaults to `2.05`
     *
     * @apiSuccess (Each result has) {object} module      The module data which contains the name, version and other useful information
     * @apiSuccess (Each result has) {object} score       The module score
     * @apiSuccess (Each result has) {object} flags       The package flags (deprecated, unstable, insecure)
     * @apiSuccess (Each result has) {number} searchScore The computed search score (from Elasticsearch)
     *
     * @apiSuccessExample {json} Response
     *     {
     *       "total": 251,
     *       "results": [
     *         {
     *           "module": { "name": "cross-spawn", "version": "4.0.0", ... },
     *           "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *           "flags": ["deprecated", "insecure", "unstable"],
     *           "searchScore": 0.0021
     *         },
     *         ...
     *       ]
     *     }
     *
     * @apiExample {curl} Usage
     *     curl "https://api.npms.io/search?q=cross+spawn"
     *
     * @apiExample {curl} With qualifiers usage
     *     curl "https://api.npms.io/search?q=cross+spawn+exclude:deprecated,insecure"
     *     curl "https://api.npms.io/search?q=sass+keywords:gulpplugin"
     */
    const queryQuerySchema = Joi.object({
        q: Joi.string().min(1).trim().lowercase(),
        from: Joi.number().min(0).default(0),
        size: Joi.number().min(1).max(250).default(25),
    }).required();

    router.get('/search',
        function * (next) {
            this.validated = validateJoiSchema(queryQuerySchema, this.request.query);
            yield next;
        },
        function * () {
            // Parse query and generate search params
            const params = Object.assign(parseQuery(this.validated.q), { from: this.validated.from, size: this.validated.size });

            this.log.debug({ params }, 'Got search params, will now fetch results');

            // Finally fetch the results from Elasticsearch
            this.body = yield fetchResults(params, esClient);
        });
};
