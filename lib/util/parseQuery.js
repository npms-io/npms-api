'use strict';

const Joi = require('joi');
const normalizeNumber = require('normalize-number');
const searchQueryParser = require('search-query-parser');
const deepCompact = require('deep-compact');
const mapKeys = require('lodash/mapKeys');
const camelCase = require('lodash/camelCase');
const uniq = require('lodash/uniq');
const validateJoiSchema = require('./validateJoiSchema');

const keywords = [
    'author', 'maintainer', 'keywords', 'not', 'is', 'boost-exact',
    'score-effect', 'popularity-weight', 'quality-weight', 'maintenance-weight',
];
const flags = ['deprecated', 'unstable', 'insecure'];

const searchParamsSchema = Joi.object({
    text: Joi.string().trim().lowercase().min(1).max(250),                                                // trim + lowercase so that the exact boost works correctly
    author: Joi.string().trim().lowercase().min(1).max(250),                                              // trim + lowercase to mimic the raw analyzer
    maintainer: Joi.string().trim().lowercase().min(1).max(250),                                          // trim + lowercase to mimic the raw analyzer
    keywords: Joi.array().items(Joi.string().trim().lowercase().min(1).max(50)).min(1).max(10).single(),  // trim + lowercase to mimic the raw analyzer
    not: Joi.array().items(Joi.string().trim().valid(flags)).single(),
    is: Joi.array().items(Joi.string().trim().valid(flags)).single(),
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

function parseKeywords(params) {
    if (!params.keywords) {
        return;
    }

    const include = [];
    const exclude = [];

    params.keywords.forEach((keyword) => {
        if (keyword.indexOf('-') === 0) {
            exclude.push(keyword.substr(1));
        } else {
            include.push(keyword);
        }
    });

    params.keywords = { include: uniq(include), exclude: uniq(exclude) };
}

function uniquifyFlags(params) {
    if (params.not) {
        params.not = uniq(params.not);
    }
    if (params.is) {
        params.is = uniq(params.is);
    }
}

// -------------------------------------------------

function parseQuery(query) {
    // Parse query into object
    query = searchQueryParser.parse(query, { keywords });
    query = typeof query === 'string' ? { text: query } : query;
    delete query.exclude;  // We do not use the exclusion feature from search-query-parser

    // Convert, validate and post-process
    const params = validateJoiSchema(searchParamsSchema, mapKeys(query, (value, key) => camelCase(key)));

    normalizeWeights(params);
    parseKeywords(params);
    uniquifyFlags(params);

    return deepCompact(params);
}

function discardQualifiers(query) {
    query = searchQueryParser.parse(query, { keywords });

    return (typeof query === 'string' ? query : query.text || '').trim();
}

module.exports = parseQuery;
module.exports.discardQualifiers = discardQualifiers;
