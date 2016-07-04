'use strict';

const Joi = require('joi');
const pick = require('lodash/pick');
const joiValidate = require('../../util/joiValidate');

const fields = ['module', 'score'];

function fetchResults(params, esClient) {
    /* eslint camelcase: 0 */

    // Need to use Promise.resolve because elasticsearch does not use native Promise
    return Promise.resolve(esClient.search({
        index: 'npms-read',
        body: {
            size: params.size,
            from: params.from,
            query: {
                match: {
                    'module.name.identifier_autocomplete': {
                        query: params.term,
                        operator: 'and',
                        analyzer: 'identifier',
                        type: 'phrase',
                        slop: 5,
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

        return result;
    });
}

// ----------------------------------------------------------

const autocompleteSchema = Joi.object({
    term: Joi.string().min(1).max(255).trim().lowercase().required(),
    size: Joi.number().min(1).max(250).default(25),
}).required();

module.exports = (router, esClient) => {
    router.get('/search/autocomplete',
        function * (next) {
            this.validated = joiValidate(autocompleteSchema, this.request.query);
            yield next;
        },
        function * () {
            const params = this.validated;

            this.log.debug({ params }, 'Will now search for autocomplete results');

            this.body = yield fetchResults(params, esClient);
        });
};
