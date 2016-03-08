#!/usr/bin/env node
'use strict';

global.Promise = require('bluebird');

require('./lib/cli/serve')(3000);

// TODO: Yargs
// TODO: npms-api serve <port>
