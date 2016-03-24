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
        from = isNumber(from) ? from : 0;
        size = isNumber(size) ? size : config.get('size');
        effect = isNumber(effect) ? effect : config.get('effect');

        weights = typeof weights === 'object' ? weights : {};
        weights = {
            quality: isNumber(weights.quality) ? Number(weights.quality) : config.get('weights.quality'),
            popularity: isNumber(weights.popularity) ? Number(weights.popularity) : config.get('weights.popularity'),
            maintenance: isNumber(weights.maintenance) ? Number(weights.maintenance) : config.get('weights.maintenance'),
        };

        // Search

        const multiMatch = {
            query: value,
            operator: 'and',
            fields: ['name.identifier_english^4', 'description.identifier_english', 'keywords.identifier_english^3'],
        };

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
                                        multi_match: Object.assign(multiMatch, {
                                            type: 'phrase',
                                            slop: 3,
                                            boost: 3,
                                        }),
                                    },
                                    {
                                        multi_match: Object.assign(multiMatch, {
                                            type: 'cross_fields',
                                        }),
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
