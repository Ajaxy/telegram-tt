const { RpcError } = require('../index').constructors;
const GZIPPacked = require('./GZIPPacked');

class RPCResult {
    static CONSTRUCTOR_ID = 0xf35c6d01;

    static classType = 'constructor';

    constructor(reqMsgId, body, error) {
        this.CONSTRUCTOR_ID = 0xf35c6d01;
        this.reqMsgId = reqMsgId;
        this.body = body;
        this.error = error;
        this.classType = 'constructor';
    }

    static async fromReader(reader) {
        const msgId = reader.readLong();
        const innerCode = reader.readInt(false);
        if (innerCode === RpcError.CONSTRUCTOR_ID) {
            return new RPCResult(msgId, undefined, RpcError.fromReader(reader));
        }
        if (innerCode === GZIPPacked.CONSTRUCTOR_ID) {
            return new RPCResult(msgId, (await GZIPPacked.fromReader(reader)).data);
        }
        reader.seek(-4);
        // This reader.read() will read more than necessary, but it's okay.
        // We could make use of MessageContainer's length here, but since
        // it's not necessary we don't need to care about it.
        return new RPCResult(msgId, reader.read(), undefined);
    }
}

module.exports = RPCResult;
