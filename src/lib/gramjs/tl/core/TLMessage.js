class TLMessage {
    static SIZE_OVERHEAD = 12;

    static classType = 'constructor';

    constructor(msgId, seqNo, obj) {
        this.msgId = msgId;
        this.seqNo = seqNo;
        this.obj = obj;
        this.classType = 'constructor';
    }
}

module.exports = TLMessage;
