'use strict';

const Joi = require('joi');
const pick = require('lodash/pick');
const joiValidate = require('../../util/joiValidate');

const fields = ['module', 'score'];

function fetchSuggestions(params, esClient) {
    /* eslint camelcase: 0 */

    // Need to use Promise.resolve because elasticsearch does not use native Promise
    return Promise.resolve(esClient.search({
        index: 'npms-read',
        body: {
            size: params.size,
            from: params.from,
            query: {
                bool: {
                    should: [
                        // Exact prefix queries get the higher boost
                        {
                            match: {
                                'module.name.autocomplete_keyword': {
                                    query: params.term,
                                    boost: 3,
                                },
                            },
                        },
                        // Promixity exact match with higher boost
                        {
                            match_phrase: {
                                'module.name': {
                                    query: params.term,
                                    slop: 0,
                                    boost: 2,
                                },
                            },
                        },
                        // Promity match using the special autocomplete field
                        {
                            match_phrase: {
                                'module.name.autocomplete': {
                                    query: params.term,
                                    slop: 2,
                                },
                            },
                        },
                    ],
                },
            },
        },
    }))
    .then((res) => res.hits.hits)
    .map((hit) => {
        // We can't use _fields in the query because the JSON properties order get messed up,
        // see https://github.com/elastic/elasticsearch/issues/17639
        // So we filter the source fields manually with pick.. this is not ideal since there's payload
        // navigating through the network that we do not use, but it's definitively better than having order messed up
        const result = pick(hit._source, fields);

        result.searchScore = hit._score;

        return result;
    });
}

// ----------------------------------------------------------

module.exports = (router, esClient) => {
    /**
     * @api {get} /search/suggestions Fetch suggestions
     * @apiName suggestions
     * @apiGroup search
     *
     * @apiParam {string} term      The search terms
     * @apiParam {string} [size=25] The total number of results to return
     *
     * @apiSuccessExample {json} Response:
     *     [
     *       {
     *         "module": { "name": "cross-spawn", "version": "4.0.0", ... },
     *         "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *         "searchScore": "0.0021"
     *       },
     *       ...
     *     ]
     *
     * @apiExample {curl} Example usage:
     *     curl "https://api.npms.io/search/suggestions?term=cross+spawn"
     */
    const suggestionsSchema = Joi.object({
        term: Joi.string().min(1).max(255).trim().lowercase().required(),
        size: Joi.number().min(1).max(100).default(25),
    }).required();

    router.get('/search/suggestions',
        function * (next) {
            this.validated = joiValidate(suggestionsSchema, this.request.query);
            yield next;
        },
        function * () {
            const params = this.validated;

            this.log.debug({ params }, 'Will now fetch suggestions');

            this.body = yield fetchSuggestions(params, esClient);
        });
};
