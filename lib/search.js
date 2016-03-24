'use strict';
const config = require('config').get('search');

class Search {
    constructor (client) {
        this.client = client;
    }

    get (value, from, size, effect, weights) {
        // Defaults

        value = value || '';
        from = from || 0;
        size = size || config.get('size');
        effect = effect || config.get('effect');
        weights = weights || {};
        weights = {
            quality: weights.quality || config.get('weights.quality') || 0,
            popularity: weights.popularity || config.get('weights.popularity') || 0,
            maintenance: weights.maintenance || config.get('weights.maintenance') || 0,
        };

        // Search

        const multiMatch = {
            query: value,
            operator: 'and',
            fields: ['name.identifier_english^4', 'description.identifier_english', 'keywords.identifier_english^3']
        };

        return this.client.search({
            index: 'npms-read',
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
                                            boost: 3
                                        })
                                    },
                                    {
                                        multi_match: Object.assign(multiMatch, {
                                            type: 'cross_fields'
                                        })
                                    }
                                ]
                            }
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
                        }
                    },
                }
            }
        });
    }
}

module.exports = Search;
