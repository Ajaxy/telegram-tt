/**
 * Converts a Telegram's RPC Error to a Python error.
 * @param rpcError the RPCError instance
 * @param request the request that caused this error
 * @constructor the RPCError as a Python exception that represents this error
 */
const { RPCError } = require('./RPCBaseErrors');
const { rpcErrorRe } = require('./RPCErrorList');

function RPCMessageToError(rpcError, request) {
    for (const [msgRegex, Cls] of rpcErrorRe) {
        const m = rpcError.errorMessage.match(msgRegex);
        if (m) {
            const capture = m.length === 2 ? parseInt(m[1], 10) : undefined;
            return new Cls({
                request,
                capture,
            });
        }
    }

    return new RPCError(rpcError.errorMessage, request);
}

const Common = require('./Common');
const RPCBaseErrors = require('./RPCBaseErrors');
const RPCErrorList = require('./RPCErrorList');

module.exports = {
    RPCMessageToError,
    ...Common,
    ...RPCBaseErrors,
    ...RPCErrorList,
};
