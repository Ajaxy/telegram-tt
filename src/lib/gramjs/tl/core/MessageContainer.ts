import { BinaryReader } from '../../extensions';
import { SecurityError } from '../../errors/Common';

import TLMessage from './TLMessage';

const MAX_INCOMING_MESSAGES = 1024;
const INNER_MESSAGE_HEADER_LENGTH = 16;
const TL_ALIGNMENT = 4;

export default class MessageContainer {
    static CONSTRUCTOR_ID = 0x73f1f8dc;

    static classType = 'constructor';

    // Maximum size in bytes for the inner payload of the container.
    // Telegram will close the connection if the payload is bigger.
    // The overhead of the container itself is subtracted.
    static MAXIMUM_SIZE = 1044456 - 8;

    // Maximum amount of messages that can't be sent inside a single
    // container, inclusive. Beyond this limit Telegram will respond
    // with BAD_MESSAGE 64 (invalid container).
    //
    // This limit is not 100% accurate and may in some cases be higher.
    // However, sending up to 100 requests at once in a single container
    // is a reasonable conservative value, since it could also depend on
    // other factors like size per request, but we cannot know this.
    static MAXIMUM_LENGTH = 100;

    private CONSTRUCTOR_ID: number;

    messages: TLMessage[];

    private classType: string;

    constructor(messages: TLMessage[]) {
        this.CONSTRUCTOR_ID = 0x73f1f8dc;
        this.messages = messages;
        this.classType = 'constructor';
    }

    static async fromReader(reader: BinaryReader) {
        return MessageContainer.readFrom(reader);
    }

    static readFrom(reader: BinaryReader) {
        const messages: TLMessage[] = [];
        const messageCount = reader.readInt();
        const containerLength = reader.getBuffer().length;

        // https://core.telegram.org/mtproto/service_messages#simple-container
        if (messageCount < 0 || messageCount > MAX_INCOMING_MESSAGES) {
            throw new SecurityError('Server sent an invalid message container count');
        }

        for (let index = 0; index < messageCount; index++) {
            const remainingLength = containerLength - reader.tellPosition();
            if (remainingLength < INNER_MESSAGE_HEADER_LENGTH) {
                throw new SecurityError('Server sent a truncated inner message header');
            }

            const msgId = reader.readLong();
            const seqNo = reader.readInt();
            const messageBodyLength = reader.readInt();
            const remainingBodyLength = containerLength - reader.tellPosition();
            if (messageBodyLength < TL_ALIGNMENT || messageBodyLength % TL_ALIGNMENT !== 0
                || messageBodyLength > remainingBodyLength) {
                throw new SecurityError('Server sent an invalid inner message length');
            }

            const messageReader = reader.createSubReader(messageBodyLength);
            const constructorId = messageReader.readInt(false);
            if (constructorId === MessageContainer.CONSTRUCTOR_ID) {
                throw new SecurityError('Server sent a nested message container');
            }

            messageReader.setPosition(0);
            const obj = messageReader.tgReadObject();
            if (messageReader.tellPosition() !== messageBodyLength) {
                throw new SecurityError('Server sent trailing inner message body data');
            }

            messages.push(new TLMessage(msgId, seqNo, obj));
        }
        return new MessageContainer(messages);
    }
}
