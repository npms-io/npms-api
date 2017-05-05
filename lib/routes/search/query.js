'use strict';

const queries = require('@npms/queries');
const Joi = require('joi');
const joiHelper = require('../../util/joiHelper.js');

module.exports = (router, esClient) => {
    /**
     * @api {get} /search Perform a search query
     * @apiName ExecuteSearchQuery
     * @apiGroup Search
     * @apiVersion 2.0.0
     *
     * @apiParam {string} q         The query with support for filters and other modifiers
     * @apiParam {string} [from=0]  The offset in which to start searching from (max of 5000)
     * @apiParam {string} [size=25] The total number of results to return (max of 250)
     *
     * @apiDescription
     *
     * Besides normal text, `q` supports qualifiers to express filters and other modifiers. Combining qualifiers is possible with a comma (`,`) for a logical or and a plus (`+`) for a logical and.
     * Examples: 
     *  - `https://api.npms.io/v2/search?q=keywords:stryker-plugin+keywords:jasmine` 
     *     This searches for packages with both "stryker-plugin" AND "jasmine" as keywords
     *  - `https://api.npms.io/v2/search?q=keywords:one,author:isaacs`
     *     This searches for packages with keywords containing "one" OR isaacs as author
     *
     * Possible qualifiers
     * - `scope:types`: Show/filter results that belong to the `@types` scope
     * - `author:sindresorhus`: Show/filter results in which `sindresorhus` is the author
     * - `maintainer:sindresorhus`: Show/filter results in which `sindresorhus` is qualifier as a maintainer
     * - `keywords:gulpplugin`: Show/filter results that have `gulpplugin` in the keywords
     *                          (separate multiple keywords with commas, you may also exclude keywords e.g.: -framework)
     * - `not:deprecated`: Exclude deprecated packages from the results
     * - `not:unstable`: Exclude packages whose version is `< 1.0.0`
     * - `not:insecure`: Exclude packages that are insecure or have vulnerable dependencies (as per [nsp](https://nodesecurity.io/))
     * - `is:deprecated`: Show/filter is deprecated packages
     * - `is:unstable`: Show/filter packages whose version is `< 1.0.0`
     * - `is:insecure`: Show/filter packages that are insecure or have vulnerable dependencies (as per [nsp](https://nodesecurity.io/))
     * - `boost-exact:false`: Do not boost exact matches, defaults to `true`
     * - `score-effect:14`: Set the effect that package scores have for the final search score, defaults to `15.3`
     * - `quality-weight:1`: Set the weight that quality has for the each package score, defaults to `1.95`
     * - `popularity-weight:1`: Set the weight that popularity has for the each package score, defaults to `3.3`
     * - `maintenance-weight:1`: Set the weight that the quality has for the each package score, defaults to `2.05`
     *
     * @apiSuccess (Each result has) {object} package     The package data which contains the name, version and other useful information
     * @apiSuccess (Each result has) {object} flags       The package flags (deprecated, unstable, insecure)
     * @apiSuccess (Each result has) {object} score       The package score
     * @apiSuccess (Each result has) {number} searchScore The computed search score (from Elasticsearch)
     *
     * @apiSuccessExample {json} Response
     *     {
     *       "total": 251,
     *       "results": [
     *         {
     *           "package": { "name": "cross-spawn-async", "version": "2.2.4", ... },
     *           "flags": { "deprecated": "Use cross-spawn instead.." },
     *           "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } },
     *           "searchScore": 0.0021
     *         },
     *         ...
     *       ]
     *     }
     *
     * @apiExample {curl} Usage
     *     curl "https://api.npms.io/v2/search?q=cross+spawn"
     *
     * @apiExample {curl} With qualifiers usage
     *     curl "https://api.npms.io/v2/search?q=cross+spawn+not:deprecated,insecure"
     *     curl "https://api.npms.io/v2/search?q=sass+keywords:gulpplugin"
     */
    const queryQuerySchema = Joi.object({
        q: Joi.string().trim().min(1).lowercase(),
        from: Joi.number().min(0).max(5000).default(0),
        size: Joi.number().min(1).max(250).default(25),
    }).required();

    router.get('/search',
        function * (next) {
            this.validated = joiHelper.validate(queryQuerySchema, this.request.query);
            yield next;
        },
        function * () {
            try {
                this.body = yield queries.search(this.validated.q, esClient, {
                    from: this.validated.from,
                    size: this.validated.size,
                    throwOnInvalid: true,
                });
            } catch (err) {
                throw joiHelper.toApiError(err);
            }
        });
};
