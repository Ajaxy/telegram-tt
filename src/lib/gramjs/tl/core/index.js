const TLMessage = require('./TLMessage');
const RPCResult = require('./RPCResult');
const MessageContainer = require('./MessageContainer');
const GZIPPacked = require('./GZIPPacked');

const coreObjects = {
    [RPCResult.CONSTRUCTOR_ID]: RPCResult,
    [GZIPPacked.CONSTRUCTOR_ID]: GZIPPacked,
    [MessageContainer.CONSTRUCTOR_ID]: MessageContainer,
};

module.exports = {
    TLMessage,
    RPCResult,
    MessageContainer,
    GZIPPacked,
    coreObjects,
};
