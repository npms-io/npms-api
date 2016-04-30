'use strict';

const index = require('config').get('elasticsearch.index');
const config = require('config').get('search');
const isNumber = require('./util/isNumber');

const fields = ['name', 'version', 'description', 'keywords', 'publisher', 'evaluation', 'score'];

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
                _source: fields,
                size,
                from,
                query: {
                    function_score: {
                        query: {
                            bool: {
                                should: [
                                    // Give boost to exact matches (phrase)
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier_english^4',
                                                'description.identifier_english',
                                                'keywords.identifier_english^3',
                                            ],
                                            analyzer: 'identifier',
                                            type: 'phrase',
                                            slop: 3,
                                            boost: 9,
                                        },
                                    },

                                    // Prefix exact matches
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier_edge_ngram^4',
                                                'description.identifier_edge_ngram',
                                                'keywords.identifier_edge_ngram^3',
                                            ],
                                            analyzer: 'identifier',
                                            type: 'phrase',
                                            slop: 3,
                                            boost: 3,
                                        },
                                    },

                                    // Normal term match
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier_english_docs^4',
                                                'description.identifier_english_docs',
                                                'keywords.identifier_english_docs^3',
                                            ],
                                            type: 'cross_fields',
                                            boost: 3,
                                        },
                                    },

                                    // Normal term match with a more aggressive stemmer (not so important)
                                    {
                                        multi_match: {
                                            query: value,
                                            operator: 'and',
                                            fields: [
                                                'name.identifier_english_aggressive_docs^4',
                                                'description.identifier_english_aggressive_docs',
                                                'keywords.identifier_english_aggressive_docs^3',
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
