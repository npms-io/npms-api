'use strict';

const bodyParser = require('koa-bodyparser');
const Joi = require('joi');
const validateNpmPackageName = require('validate-npm-package-name');
const keyBy = require('lodash/keyBy');
const validateJoiSchema = require('../../util/validateJoiSchema');

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
    return npmsNano.fetchAsync({ keys: names.map((name) => `module!${name}`) })
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
        type: 'module',
        body: { ids: names },
        _source: ['score'],
    }))
    .get('docs')
    .map((doc) => doc._source);
}

// ----------------------------------------------------------

module.exports = (router, npmsNano, esClient) => {
    /**
     * @api {get} /module/:name Get module info
     * @apiName get-info
     * @apiGroup module
     *
     * @apiParam {string} name The module name
     *
     * @apiSuccess {string} analyzedAt  The date in which the module was last analyzed
     * @apiSuccess {object} collected   The collected information from all sources
     * @apiSuccess {object} evaluation  The module evaluation
     * @apiSuccess {object} score       The module score
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
     *     curl "https://api.npms.io/module/react"
     */
    const infoParamsSchema = Joi.object({
        name: Joi.string().required(),
    }).required();

    router.get('/module/:name',
        function * (next) {
            this.validated = validateJoiSchema(infoParamsSchema, this.params);
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

            // Check if the module does not exist
            if (!info.couchdb || !info.elasticsearch) {
                throw Object.assign(new Error('Module not found'), { code: 'NOT_FOUND', status: 404, expose: true });
            }

            this.body = Object.assign({}, info.couchdb, info.elasticsearch);
        });

    /**
     * @api {post} /module/mget Get several modules info
     * @apiName mget-info
     * @apiGroup module
     *
     * @apiParam {array} names The module names, specified as the request body
     *
     * @apiSuccess (Each info has) {string} analyzedAt  The date in which the module was last analyzed
     * @apiSuccess (Each info has) {object} collected   The collected information from all sources
     * @apiSuccess (Each info has) {object} evaluation  The module evaluation
     * @apiSuccess (Each info has) {object} score       The module score
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
     *     curl -X POST "https://api.npms.io/module/mget" \
     *     	    -H "Accept: application/json" \
     *     	    -H "Content-Type: application/json" \
     *     	    -d '["cross-spawn", "react"]'
     */
    const infoMgetBodySchema = Joi.array().label('names').min(1).max(250).unique().items(Joi.string()).required();

    router.post('/module/mget',
        bodyParser({ enableTypes: ['json'] }),
        function * (next) {
            this.validated = validateNames(validateJoiSchema(infoMgetBodySchema, this.request.body));
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

            // Build the modules array, clearing the ones that do not exist
            const modules = info.couchdb
            .map((infoCouchdb, index) => {
                const infoElasticsearch = info.elasticsearch[index];

                return !infoCouchdb || !infoElasticsearch ? null :
                    Object.assign({}, infoCouchdb, infoElasticsearch);
            })
            .filter((module) => !!module);

            // Return an object indexed by name
            this.body = keyBy(modules, (module) => module.collected.metadata.name);
        });
};
