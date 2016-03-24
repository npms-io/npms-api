'use strict';
const bootstrap = require('../lib/bootstrap');

module.exports = (port) => {
    const app = bootstrap();

    app.listen(port || 3000);
};
