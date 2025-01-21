import type BigInt from 'big-integer';

export default class TLMessage {
    static SIZE_OVERHEAD = 12;

    static classType = 'constructor';

    msgId: BigInt.BigInteger;

    private seqNo: number;

    obj: any;

    constructor(msgId: bigInt.BigInteger, seqNo: number, obj: any) {
        this.msgId = msgId;
        this.seqNo = seqNo;
        this.obj = obj;
    }
}
