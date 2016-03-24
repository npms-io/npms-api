'use strict';


module.exports = function (search) {
    return function * () {
        const result = yield search.get(this.request.query.q);

        this.body = {
            results: result.hits.hits.map((hit) => {
                return {
                    name: hit._id,
                    description: hit._source.description,
                    keywords: (hit._source.keywords || []).join('; '),
                    score: hit._score,
                    analysisScore: Object.assign({final: hit._source.score.final}, hit._source.score.detail),
                }
            })
        };
    };
};
