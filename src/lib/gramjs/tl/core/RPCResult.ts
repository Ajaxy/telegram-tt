
import type { BinaryReader } from '../../extensions';

import Api from '../api';

import GZIPPacked from './GZIPPacked';

export default class RPCResult {
    static CONSTRUCTOR_ID = 0xf35c6d01;

    static classType = 'constructor';

    private CONSTRUCTOR_ID: number;

    private reqMsgId: bigint;

    private body?: Buffer;

    private error?: Api.RpcError;

    private classType: string;

    constructor(
        reqMsgId: bigint,
        body?: Buffer,
        error?: Api.RpcError,
    ) {
        this.CONSTRUCTOR_ID = 0xf35c6d01;
        this.reqMsgId = reqMsgId;
        this.body = body;
        this.error = error;
        this.classType = 'constructor';
    }

    static async fromReader(reader: BinaryReader) {
        const msgId = reader.readLong();
        const innerCode = reader.readInt(false);
        if (innerCode === Api.RpcError.CONSTRUCTOR_ID) {
            return new RPCResult(
                msgId,
                undefined,
                Api.RpcError.fromReader(reader),
            );
        }
        if (innerCode === GZIPPacked.CONSTRUCTOR_ID) {
            return new RPCResult(
                msgId,
                (await GZIPPacked.fromReader(reader)).data,
            );
        }
        reader.seek(-4);
        // This reader.read() will read more than necessary, but it's okay.
        // We could make use of MessageContainer's length here, but since
        // it's not necessary we don't need to care about it.
        return new RPCResult(msgId, reader.read(), undefined);
    }
}
