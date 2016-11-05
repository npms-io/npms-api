'use strict';

const bodyParser = require('koa-bodyparser');
const Joi = require('joi');
const validateNpmPackageName = require('validate-npm-package-name');
const keyBy = require('lodash/keyBy');
const uniq = require('lodash/uniq');
const joiHelper = require('../../util/joiHelper');

function validateNames(names) {
    names.forEach((name) => {
        const validation = validateNpmPackageName(name);

        if (validation.errors) {
            throw Object.assign(new Error(`${validation.errors[0]} ("${name}")`),
                { code: 'INVALID_PARAMETER', status: 400, expose: true });
        }
    });

    return names;
}

function fetchFromCouchdb(names, npmsNano) {
    return npmsNano.fetchAsync({ keys: names.map((name) => `package!${name}`) })
    .get('rows')
    .map((row) => {
        if (row.doc) {
            return {
                analyzedAt: row.doc.finishedAt,
                collected: row.doc.collected,
                evaluation: row.doc.evaluation,
            };
        }

        if (row.error === 'not_found') {
            return null;
        }

        throw Object.assign(new Error(`Unable to retrieve ${row.key} from CouchDB`), { code: row.error });
    });
}

function fetchFromElasticsearch(names, esClient) {
    return Promise.resolve(esClient.mget({
        index: 'npms-current',
        type: 'score',
        body: { ids: names },
        _source: ['score'],
    }))
    .get('docs')
    .map((doc) => doc._source);
}

// ----------------------------------------------------------

module.exports = (router, npmsNano, esClient) => {
    /**
     * @api {get} /package/:name Get package info
     * @apiName GetPackageInfo
     * @apiGroup Package
     * @apiVersion 2.0.0
     *
     * @apiParam {string} name The package name
     *
     * @apiSuccess {string} analyzedAt  The date in which the package was last analyzed
     * @apiSuccess {object} collected   The collected information from all sources
     * @apiSuccess {object} evaluation  The package evaluation
     * @apiSuccess {object} score       The package score
     *
     * @apiSuccessExample {json} Response
     *     {
     *       "analyzedAt": "2016-07-04T23:04:54.646Z",
     *       "collected": { "metadata": { ... }, "npm": { ... }, ... },
     *       "evaluation": { "quality": { ... }, "popularity": { ... }, ... }
     *       "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } }
     *     }
     *
     * @apiExample {curl} Usage
     *     curl "https://api.npms.io/v2/package/react"
     */
    const infoParamsSchema = Joi.object({
        name: Joi.string().trim().min(1).required(),
    }).required();

    router.get('/package/:name',
        function * (next) {
            this.validated = joiHelper.validate(infoParamsSchema, this.params);
            validateNames([this.validated.name]);
            yield next;
        },
        function * () {
            const names = [this.validated.name];

            this.log.debug({ names }, 'Will fetch info');

            // Fetch info
            const info = yield Promise.props({
                couchdb: fetchFromCouchdb(names, npmsNano).get(0),
                elasticsearch: fetchFromElasticsearch(names, esClient).get(0),
            });

            this.log.debug({ names, info }, 'Got info');

            // Check if the package does not exist
            if (!info.couchdb || !info.elasticsearch) {
                throw Object.assign(new Error('Module not found'), { code: 'NOT_FOUND', status: 404, expose: true });
            }

            this.body = Object.assign({}, info.couchdb, info.elasticsearch);
        });

    /**
     * @api {post} /package/mget Get various packages info
     * @apiName GetMultiPackageInfo
     * @apiGroup Package
     * @apiVersion 2.0.0
     *
     * @apiParam {array} names The package names, specified as the request body
     *
     * @apiSuccess (Each info has) {string} analyzedAt  The date in which the package was last analyzed
     * @apiSuccess (Each info has) {object} collected   The collected information from all sources
     * @apiSuccess (Each info has) {object} evaluation  The package evaluation
     * @apiSuccess (Each info has) {object} score       The package score
     *
     * @apiSuccessExample {json} Response
     *     {
     *       "cross-spawn": {
     *         "analyzedAt": "2016-07-04T23:04:54.646Z",
     *         "collected": { "metadata": { ... }, "npm": { ... }, ... },
     *         "evaluation": { "quality": { ... }, "popularity": { ... }, ... }
     *         "score": { "final": 0.89, "detail": { "quality": 0.99, "popularity": 0.77, ... } }
     *       },
     *       "react": {
     *         "analyzedAt": "2016-07-03T11:23:04.553Z",
     *         "collected": { "metadata": { ... }, "npm": { ... }, ... },
     *         "evaluation": { "quality": { ... }, "popularity": { ... }, ... }
     *         "score": { "final": 0.95, "detail": { "quality": 0.99, "popularity": 0.93, ... } }
     *       }
     *     }
     *
     * @apiExample {curl} Example usage
     *     curl -X POST "https://api.npms.io/v2/package/mget" \
     *     	    -H "Accept: application/json" \
     *     	    -H "Content-Type: application/json" \
     *     	    -d '["cross-spawn", "react"]'
     */
    const infoMgetBodySchema = Joi.array().label('names').min(1).max(250).items(Joi.string().trim().min(1)).required();

    router.post('/package/mget',
        bodyParser({ enableTypes: ['json'] }),
        function * (next) {
            this.validated = validateNames(joiHelper.validate(infoMgetBodySchema, uniq(this.request.body)));
            yield next;
        },
        function * () {
            const names = this.validated;

            this.log.debug({ names }, 'Will fetch info');

            // Fetch info
            const info = yield Promise.props({
                couchdb: fetchFromCouchdb(names, npmsNano),
                elasticsearch: fetchFromElasticsearch(names, esClient),
            });

            this.log.debug({ names, info }, 'Got info');

            // Build the packages array, clearing the ones that do not exist
            const infos = info.couchdb
            .map((infoCouchdb, index) => {
                const infoElasticsearch = info.elasticsearch[index];

                return !infoCouchdb || !infoElasticsearch ? null :
                    Object.assign({}, infoCouchdb, infoElasticsearch);
            })
            .filter((info) => !!info);

            // Return an object indexed by name
            this.body = keyBy(infos, (info) => info.collected.metadata.name);
        });
};
