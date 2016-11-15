'use strict';

const Promise = require('bluebird');
const pino = require('pino');
const pinoErrSerializer = require('pino-err-serializer');

// Configure bluebird
// ----------------------------------------------------

// Make bluebird global
global.Promise = Promise;

// Improve debugging by enabling long stack traces.. it has minimal impact in production
Promise.config({ longStackTraces: true, warnings: false });


// Configure global logger (pino)
// ----------------------------------------------------

global.logger = pino({ name: 'npms-api', serializers: { err: pinoErrSerializer } });
