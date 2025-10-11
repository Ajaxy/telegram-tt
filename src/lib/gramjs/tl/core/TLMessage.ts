export default class TLMessage {
    static SIZE_OVERHEAD = 12;

    static classType = 'constructor';

    msgId: bigint;

    private seqNo: number;

    obj: any;

    constructor(msgId: bigint, seqNo: number, obj: any) {
        this.msgId = msgId;
        this.seqNo = seqNo;
        this.obj = obj;
    }
}
