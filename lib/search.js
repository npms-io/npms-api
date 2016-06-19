'use strict';

const index = require('config').get('elasticsearch.index');
const config = require('config').get('search');
const isNumber = require('./util/isNumber');

const fields = ['name', 'version', 'description', 'keywords', 'publisher', 'date', 'links', 'evaluation', 'score'];

module.exports = function (client, value, from, size, effect, weights) {
    // Validation and defaults
    value = typeof value === 'string' ? value.toLowerCase() : '';
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
    return client.search({
        index,
        body: {
            _source: fields,
            size,
            from,
            query: {
                function_score: {
                    boost_mode: 'replace',
                    query: {
                        bool: {
                            should: [

                                // Prefix matches using edge-ngram
                                {
                                    multi_match: {
                                        query: value,
                                        operator: 'and',
                                        fields: [
                                            'name.identifier_edge_ngram^4',
                                            'description.identifier_edge_ngram',
                                            'keywords.identifier_edge_ngram^2',
                                        ],
                                        analyzer: 'identifier',
                                        type: 'phrase',
                                        slop: 3,
                                        boost: 3,
                                    },
                                },

                                // Normal term match with an english stemmer
                                {
                                    multi_match: {
                                        query: value,
                                        operator: 'and',
                                        fields: [
                                            'name.identifier_english_docs^4',
                                            'description.identifier_english_docs',
                                            'keywords.identifier_english_docs^2',
                                        ],
                                        analyzer: 'identifier_english',
                                        type: 'cross_fields',
                                        boost: 3,
                                    },
                                },

                                // Normal term match with a more aggressive english stemmer (not so important)
                                {
                                    multi_match: {
                                        query: value,
                                        operator: 'and',
                                        fields: [
                                            'name.identifier_english_aggressive_docs^4',
                                            'description.identifier_english_aggressive_docs',
                                            'keywords.identifier_english_aggressive_docs^2',
                                        ],
                                        analyzer: 'identifier_english_aggressive',
                                        type: 'cross_fields',
                                    },
                                },
                            ],
                        },
                    },
                    script_score: {
                        lang: 'groovy',
                        script: '(doc["name.raw"].value.equals(name)) ? 1 : _score * pow(' +
                        'doc["score.detail.popularity"].value * weightPopularity + ' +
                        'doc["score.detail.quality"].value * weightQuality + ' +
                        'doc["score.detail.maintenance"].value * weightMaintenance, ' +
                        'effect)',
                        params: {
                            name: value,
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
};
