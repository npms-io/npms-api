'use strict';

const fs = require('fs');
const router = require('koa-joi-router')();
const container = require('./container');

fs.readdirSync('./lib/controllers').forEach((file) => {
    require(`./controllers/${file}`)(router, container);
});

module.exports = router.middleware();
