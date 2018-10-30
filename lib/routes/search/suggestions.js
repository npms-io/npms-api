'use strict';

const queries = require('@npms/queries');
const Joi = require('joi');
const joiHelper = require('../../util/joiHelper.js');

module.exports = (router, esClient) => {
    /**
     * @api {get} /search/suggestions Fetch suggestions
     * @apiName SearchSuggestions
     * @apiGroup Search
     * @apiVersion 2.0.0
     *
     * @apiParam {string} q         The query (note that any qualifiers will be ignored)
     * @apiParam {string} [size=25] The total number of results to return (max of 100)
     *
     * @apiSuccess (Each result has) {object} package     The package data which contains the name, version and other useful information
     * @apiSuccess (Each result has) {object} flags       The package flags (deprecated, unstable, insecure)
     * @apiSuccess (Each result has) {object} score       The package score
     * @apiSuccess (Each result has) {number} searchScore The computed search score (from Elasticsearch)
     * @apiSuccess (Each result has) {string} [highlight] A string containing highlighted matched text
     *
     * @apiSuccessExample {json} Response
     *     [
     *       {
     *         "package": { "name": "cross-spawn", "version": "4.0.0", ... },
     *         "flags": { "deprecated": "Use cross-spawn instead.." },
     *         "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *         "searchScore": 0.0021,
     *         "highlight": "&lt;em&gt;cross&lt;/em&gt;-spawn"
     *       },
     *       ...
     *     ]
     *
     * @apiExample {curl} Usage
     *     curl "https://api.npms.io/v2/search/suggestions?q=cross+spawn"
     */
    /* eslint-disable newline-per-chained-call */
    const suggestionsQuerySchema = Joi.object({
        q: Joi.string().trim().min(1).max(250).lowercase().required(),
        size: Joi.number().min(1).max(100).default(25),
    }).required();
    /* eslint-enable newline-per-chained-call */

    router.get('/search/suggestions',
        function* (next) {
            this.validated = joiHelper.validate(suggestionsQuerySchema, this.request.query);
            yield next;
        },
        function* () {
            this.body = yield queries.search.suggestions(this.validated.q, esClient, {
                size: this.validated.size,
            });
        });
};
