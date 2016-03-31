#!/usr/bin/env node
'use strict';

const app = require('./lib/app')();

app.listen(process.argv[2] || 3000);
