'use strict';

const Joi = require('joi');
const pick = require('lodash/pick');
const validateJoiSchema = require('../../util/validateJoiSchema');

const fields = ['package', 'score'];

function fetchSuggestions(params, esClient) {
    /* eslint camelcase: 0 */

    // Need to use Promise.resolve because Elasticsearch does not use native Promise
    return Promise.resolve(esClient.search({
        index: 'npms-current',
        body: {
            size: params.size,
            from: params.from,
            highlight: {
                fields: {
                    'package.name.autocomplete_highlight': { type: 'postings' },
                },
            },
            query: {
                function_score: {
                    boost_mode: 'replace',
                    query: {
                        bool: {
                            // Match against the autocomplete field
                            must: [
                                {
                                    match_phrase: {
                                        'package.name.autocomplete': {
                                            query: params.text,
                                            slop: 3,
                                        },
                                    },
                                },
                            ],
                            should: [
                                // Exact prefix queries get the higher boost
                                {
                                    match: {
                                        'package.name.autocomplete_keyword': {
                                            query: params.text,
                                            boost: 4,
                                        },
                                    },
                                },
                                // Promixity exact match get medium boost
                                // e.g.: searching for "react form" should give higher score to "react-form-fields" than "react-formal"
                                {
                                    match_phrase: {
                                        'package.name': {
                                            query: params.text,
                                            slop: 0,
                                            boost: 2,
                                        },
                                    },
                                },
                                // This is just here for the highlighting
                                {
                                    match_phrase: {
                                        'package.name.autocomplete_highlight': {
                                            query: params.text,
                                            slop: 50,  // This needs to be high because each expansion is a word
                                        },
                                    },
                                },
                            ],
                        },
                    },
                    script_score: {
                        lang: 'groovy',
                        script: 'doc["package.name.raw"].value.equals(text) ? 100000 + _score : _score',
                        params: { text: params.text },
                    },
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
        result.highlight = hit.highlight && hit.highlight['package.name.autocomplete_highlight'][0];

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
     * @apiParam {string} text      The text to search
     * @apiParam {string} [size=25] The total number of results to return
     *
     * @apiSuccess (Each result has) {object} package     The package data which contains the name, version and other useful information
     * @apiSuccess (Each result has) {object} score       The package score
     * @apiSuccess (Each result has) {number} searchScore The computed search score (from Elasticsearch)
     * @apiSuccess (Each result has) {string} [highlight] A string containing highlighted matched text
     *
     * @apiSuccessExample {json} Response
     *     [
     *       {
     *         "package": { "name": "cross-spawn", "version": "4.0.0", ... },
     *         "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *         "searchScore": 0.0021,
     *         "highlight": "&lt;em&gt;cross&lt;/em&gt;-spawn"
     *       },
     *       ...
     *     ]
     *
     * @apiExample {curl} Usage
     *     curl "https://api.npms.io/search/suggestions?text=cross+spawn"
     */
    const suggestionsQuerySchema = Joi.object({
        text: Joi.string().min(1).max(255).trim().lowercase().required(),
        size: Joi.number().min(1).max(100).default(25),
    }).required();

    router.get('/search/suggestions',
        function * (next) {
            this.validated = validateJoiSchema(suggestionsQuerySchema, this.request.query);
            yield next;
        },
        function * () {
            const params = this.validated;

            this.log.debug({ params }, 'Validated inputed, will now fetch suggestions');

            this.body = yield fetchSuggestions(params, esClient);
        });
};
