'use strict';
const bootstrap = require('../bootstrap');

module.exports = (port) => {
    const app = bootstrap();

    app.listen(port);
};
