'use strict';

const Joi = require('joi');
const normalizeNumber = require('normalize-number');
const searchQueryParser = require('search-query-parser');
const mapKeys = require('lodash/mapKeys');
const camelCase = require('lodash/camelCase');
const validateJoiSchema = require('./validateJoiSchema');

const keywords = [
    'author', 'maintainer', 'keywords', 'exclude', 'boost-exact',
    'score-effect', 'popularity-weight', 'quality-weight', 'maintenance-weight',
];
const flags = ['deprecated', 'unstable', 'insecure'];

const searchParamsSchema = Joi.object({
    text: Joi.string().min(1).max(250).trim().lowercase().default(''),
    author: Joi.string().min(1).max(250),
    maintainer: Joi.string().min(1).max(250),
    keywords: Joi.array().items(Joi.string().min(1).max(50)).min(1).max(10).single(),
    exclude: Joi.array().items(Joi.string().valid(flags)).single(),
    boostExact: Joi.boolean().default(true),
    scoreEffect: Joi.number().min(0).max(25).default(15.3),
    qualityWeight: Joi.number().min(0).max(100).default(1.95),      // ~0.27
    popularityWeight: Joi.number().min(0).max(100).default(3.3),    // ~0.45
    maintenanceWeight: Joi.number().min(0).max(100).default(2.05),  // ~0.28
}).required();

function normalizeWeights(params) {
    const minMax = [0, params.qualityWeight + params.popularityWeight + params.maintenanceWeight];

    params.qualityWeight = normalizeNumber(minMax, params.qualityWeight);
    params.popularityWeight = normalizeNumber(minMax, params.popularityWeight);
    params.maintenanceWeight = normalizeNumber(minMax, params.maintenanceWeight);
}

// -------------------------------------------------

function parseQuery(query) {
    // Parse query into object
    query = searchQueryParser.parse(query, { keywords });
    query = typeof query === 'string' ? { text: query } : query;

    // Convert & validate
    const params = validateJoiSchema(searchParamsSchema, mapKeys(query, (value, key) => camelCase(key)));

    normalizeWeights(params);

    return params;
}

module.exports = parseQuery;
