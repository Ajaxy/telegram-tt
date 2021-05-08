const api = require('./api');
const {
    serializeBytes,
    serializeDate,
} = require('./generationHelpers');

const patched = null;

module.exports = {
    // TODO Refactor internal usages to always use `api`.
    constructors: api,
    requests: api,
    patched,
    serializeBytes,
    serializeDate,
};
