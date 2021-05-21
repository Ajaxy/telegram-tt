const api = require('./api');
const {
    serializeBytes,
    serializeDate,
} = require('./generationHelpers');

module.exports = {
    // TODO Refactor internal usages to always use `api`.
    constructors: api,
    requests: api,
    serializeBytes,
    serializeDate,
};
