const NewMessage = require('./NewMessage');
const Raw = require('./Raw');

class StopPropagation extends Error {

}

module.exports = {
    NewMessage,
    StopPropagation,
    Raw,
};
