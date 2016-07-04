'use strict';

function joiValidate(schema, input) {
    const validation = schema.validate(input);

    if (validation.error) {
        throw Object.assign(validation.error, { code: 'INVALID_PARAMETER', status: 400, expose: true });
    }

    return validation.value;
}

module.exports = joiValidate;
