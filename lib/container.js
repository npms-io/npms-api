'use strict';

const config = require('config');
const ElasticSearch = require('elasticsearch');
const omit = require('lodash.omit');
const Search = require('./search');

// Controller dependencies

const container = {};

container.elasticClient = new ElasticSearch.Client(Object.assign({}, omit(config.get('elasticsearch'), 'index')));
container.search = new Search(container.elasticClient);

module.exports = container;
