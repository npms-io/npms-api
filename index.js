#!/usr/bin/env node
'use strict';

const app = require('../lib/bootstrap')();

app.listen(process.argv[2] || 3000);
