'use strict';

function validate(schema, input) {
    const validation = schema.validate(input);

    if (validation.error) {
        throw toApiError(validation.error);
    }

    return validation.value;
}

function toApiError(err) {
    if (err.isJoi) {
        throw Object.assign(err, { code: 'INVALID_PARAMETER', status: 400, expose: true });
    }

    throw err;
}

module.exports.validate = validate;
module.exports.toApiError = toApiError;
