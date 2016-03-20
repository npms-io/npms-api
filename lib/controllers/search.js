'use strict';
const ElasticSearch = require('elasticsearch');
const client = new ElasticSearch.Client();

module.exports = function * () {
    //this.body = yield Promise.delay(100).return('hello world');
    const effect = 3;

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
                                            fields: ['name^10', 'description', 'keywords^5'],
                                            type: 'best_fields',
                                            tie_breaker: 0.3,
                                            boost: 5,
                                        },
                                    },
                                    {
                                        multi_match: {
                                            query: this.request.query.q || '',
                                            operator: 'and',
                                            fields: ['name^10', 'description', 'keywords^5'],
                                            type: 'cross_fields',
                                        }
                                    }
                                ],
                                minimum_should_match: 1
                            }
                            //match_all: {}
                        },
                        script_score: {
                            script: `pow(doc["score.detail.popularity"].value, ${effect})`,
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
                score: hit._score,
                analysisScore: hit._source.score,
            }
        })
    };
};
