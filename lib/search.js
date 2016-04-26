'use strict';
const index = require('config').get('elasticSearch.index');
const config = require('config').get('search');
const isNumber = require('./util/isNumber');

class Search {
    constructor(client) {
        this.client = client;
    }

    get(value, from, size, effect, weights) {
        // Validation and defaults
        value = typeof value === 'string' ? value : '';
        from = isNumber(from) ? Number(from) : 0;
        size = isNumber(size) ? Number(size) : config.get('size');
        effect = isNumber(effect) ? Number(effect) : config.get('effect');

        weights = typeof weights === 'object' ? weights : {};
        weights = {
            quality: isNumber(weights.quality) ? Number(weights.quality) : config.get('weights.quality'),
            popularity: isNumber(weights.popularity) ? Number(weights.popularity) : config.get('weights.popularity'),
            maintenance: isNumber(weights.maintenance) ? Number(weights.maintenance) : config.get('weights.maintenance'),
        };

        // Search

        /* eslint camelcase: 0 */
        return this.client.search({
            index,
            body: {
                size,
                from,
                query: {
                    function_score: {
                        query: {
                            bool: {
                                should: [
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier^4',
                                                'description.identifier',
                                                'keywords.identifier^3',
                                            ],
                                            type: 'phrase',
                                            slop: 3,
                                            boost: 3,
                                        },
                                    },
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier_docs^4',
                                                'description.identifier_docs',
                                                'keywords.identifier_docs^3',
                                            ],
                                            type: 'cross_fields',
                                        },
                                    },
                                ],
                            },
                        },
                        script_score: {
                            lang: 'groovy',
                            script: 'pow(' +
                            'doc["score.detail.popularity"].value * weightPopularity + ' +
                            'doc["score.detail.quality"].value * weightQuality + ' +
                            'doc["score.detail.maintenance"].value * weightMaintenance, ' +
                            'effect)',
                            params: {
                                effect,
                                weightPopularity: weights.popularity,
                                weightQuality: weights.quality,
                                weightMaintenance: weights.maintenance,
                            },
                        },
                    },
                },
            },
        });
    }
}

module.exports = Search;
