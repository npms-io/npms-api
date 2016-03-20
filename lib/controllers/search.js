'use strict';
const ElasticSearch = require('elasticsearch');
const client = new ElasticSearch.Client();

module.exports = function * () {
    const effect = this.request.query.effect || 7;

    const resp = yield client.search({
        index: 'npms-read',
        //analyzer: 'simple',
        body: {
            size: 50,
                query: {
                    function_score: {
                        query: {
                            bool: {
                                should: [
                                    {
                                        multi_match: {
                                            query: this.request.query.q || '',
                                            operator: 'and',
                                            fields: ['name^5', 'description', 'keywords^5'],
                                            type: 'best_fields',
                                            tie_breaker: 0,
                                        },
                                    },
                                    {
                                        multi_match: {
                                            query: this.request.query.q || '',
                                            operator: 'and',
                                            fields: ['name^5', 'description', 'keywords^5'],
                                            type: 'cross_fields',
                                        }
                                    },
                                ],
                                minimum_should_match: 1
                            }
                        },
                        script_score: {
                            script: `_score * pow(doc["score.final"].value, ${effect})`,
                            "lang": "groovy"
                        }
                    },
                }
        }
    });

    this.body = {
        results: resp.hits.hits.map((hit) => {
            return {
                name: hit._id,
                description: hit._source.description,
                keywords: hit._source.keywords || [],
                score: hit._score,
                analysisScore: hit._source.score,
            }
        })
    };
};
