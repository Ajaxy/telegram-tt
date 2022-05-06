const BigInt = require('big-integer');
const aes = require('@cryptography/aes');

const Helpers = require('../Helpers');
const IGE = require('../crypto/IGE');
const BinaryReader = require('../extensions/BinaryReader');
const GZIPPacked = require('../tl/core/GZIPPacked');
const { TLMessage } = require('../tl/core');
const {
    SecurityError,
    InvalidBufferError,
} = require('../errors/Common');
const { InvokeAfterMsg } = require('../tl').requests;
const {
    toSignedLittleBuffer,
} = require('../Helpers');

class MTProtoState {
    /**
     *
     `telethon.network.mtprotosender.MTProtoSender` needs to hold a state
     in order to be able to encrypt and decrypt incoming/outgoing messages,
     as well as generating the message IDs. Instances of this class hold
     together all the required information.

     It doesn't make sense to use `telethon.sessions.abstract.Session` for
     the sender because the sender should *not* be concerned about storing
     this information to disk, as one may create as many senders as they
     desire to any other data center, or some CDN. Using the same session
     for all these is not a good idea as each need their own authkey, and
     the concept of "copying" sessions with the unnecessary entities or
     updates state for these connections doesn't make sense.

     While it would be possible to have a `MTProtoPlainState` that does no
     encryption so that it was usable through the `MTProtoLayer` and thus
     avoid the need for a `MTProtoPlainSender`, the `MTProtoLayer` is more
     focused to efficiency and this state is also more advanced (since it
     supports gzipping and invoking after other message IDs). There are too
     many methods that would be needed to make it convenient to use for the
     authentication process, at which point the `MTProtoPlainSender` is better
     * @param authKey
     * @param loggers
     * @param isCall
     * @param isOutgoing
     */
    constructor(authKey, loggers, isCall = false, isOutgoing = false) {
        this.authKey = authKey;
        this._log = loggers;
        this._isCall = isCall;
        this._isOutgoing = isOutgoing;
        this.timeOffset = 0;
        this.salt = 0;

        this.id = undefined;
        this._sequence = undefined;
        this._lastMsgId = undefined;
        this.msgIds = [];
        this.reset();
    }

    /**
     * Resets the state
     */
    reset() {
        // Session IDs can be random on every connection
        this.id = Helpers.generateRandomLong(true);
        this._sequence = 0;
        this._lastMsgId = BigInt(0);
        this.msgIds = [];
    }

    /**
     * Updates the message ID to a new one,
     * used when the time offset changed.
     * @param message
     */
    updateMessageId(message) {
        message.msgId = this._getNewMsgId();
    }

    /**
     * Calculate the key based on Telegram guidelines, specifying whether it's the client or not
     * @param authKey
     * @param msgKey
     * @param client
     * @returns {{iv: Buffer, key: Buffer}}
     */
    async _calcKey(authKey, msgKey, client) {
        const x = (this._isCall ? 128 + ((this._isOutgoing ^ client) ? 8 : 0) : (client === true ? 0 : 8));
        const [sha256a, sha256b] = await Promise.all([
            Helpers.sha256(Buffer.concat([msgKey, authKey.slice(x, x + 36)])),
            Helpers.sha256(Buffer.concat([authKey.slice(x + 40, x + 76), msgKey])),
        ]);
        const key = Buffer.concat([sha256a.slice(0, 8), sha256b.slice(8, 24), sha256a.slice(24, 32)]);
        if (this._isCall) {
            const iv = Buffer.concat([sha256b.slice(0, 4), sha256a.slice(8, 16), sha256b.slice(24, 28)]);

            return {
                key,
                iv,
            };
        }
        const iv = Buffer.concat([sha256b.slice(0, 8), sha256a.slice(8, 24), sha256b.slice(24, 32)]);
        return {
            key,
            iv,
        };
    }

    /**
     * Writes a message containing the given data into buffer.
     * Returns the message id.
     * @param buffer
     * @param data
     * @param contentRelated
     * @param afterId
     */
    async writeDataAsMessage(buffer, data, contentRelated, afterId) {
        const msgId = this._getNewMsgId();
        const seqNo = this._getSeqNo(contentRelated);
        let body;
        if (!afterId) {
            body = await GZIPPacked.gzipIfSmaller(contentRelated, data);
        } else {
            // Invoke query expects a query with a getBytes func
            body = await GZIPPacked.gzipIfSmaller(contentRelated, new InvokeAfterMsg(afterId, {
                getBytes() {
                    return data;
                },
            }).getBytes());
        }
        const s = Buffer.alloc(4);
        s.writeInt32LE(seqNo, 0);
        const b = Buffer.alloc(4);
        b.writeInt32LE(body.length, 0);
        const m = toSignedLittleBuffer(msgId, 8);
        buffer.write(Buffer.concat([m, s, b]));
        buffer.write(body);
        return msgId;
    }

    /**
     * Encrypts the given message data using the current authorization key
     * following MTProto 2.0 guidelines core.telegram.org/mtproto/description.
     * @param data
     */
    async encryptMessageData(data) {
        await this.authKey.waitForKey();
        if (this._isCall) {
            const x = 128 + (this._isOutgoing ? 0 : 8);
            const lengthStart = data.length;

            data = Buffer.from(data);
            if (lengthStart % 4 !== 0) {
                data = Buffer.concat([data, Buffer.from(new Array(4 - (lengthStart % 4)).fill(0x20))]);
            }

            const msgKeyLarge = await Helpers.sha256(Buffer.concat([this.authKey.getKey()
                .slice(88 + x, 88 + x + 32), Buffer.from(data)]));

            const msgKey = msgKeyLarge.slice(8, 24);

            const {
                iv,
                key,
            } = await this._calcKey(this.authKey.getKey(), msgKey, true);

            data = Helpers.convertToLittle(new aes.CTR(key, iv).encrypt(data));
            // data = data.slice(0, lengthStart)
            return Buffer.concat([msgKey, data]);
        } else {
            const s = toSignedLittleBuffer(this.salt, 8);
            const i = toSignedLittleBuffer(this.id, 8);
            data = Buffer.concat([Buffer.concat([s, i]), data]);
            const padding = Helpers.generateRandomBytes(Helpers.mod(-(data.length + 12), 16) + 12);
            // Being substr(what, offset, length); x = 0 for client
            // "msg_key_large = SHA256(substr(auth_key, 88+x, 32) + pt + padding)"
            const msgKeyLarge = await Helpers.sha256(Buffer.concat([this.authKey.getKey()
                .slice(88, 88 + 32), data, padding]));
            // "msg_key = substr (msg_key_large, 8, 16)"
            const msgKey = msgKeyLarge.slice(8, 24);

            const {
                iv,
                key,
            } = await this._calcKey(this.authKey.getKey(), msgKey, true);

            const keyId = Helpers.readBufferFromBigInt(this.authKey.keyId, 8);
            return Buffer.concat([keyId, msgKey, new IGE(key, iv).encryptIge(Buffer.concat([data, padding]))]);
        }
    }

    /**
     * Inverse of `encrypt_message_data` for incoming server messages.
     * @param body
     */
    async decryptMessageData(body) {
        if (body.length < 8) {
            throw new InvalidBufferError(body);
        }
        if (body.length < 0) { // length needs to be positive
            throw new SecurityError('Server replied with negative length');
        }
        if (body.length % 4 !== 0 && !this._isCall) {
            throw new SecurityError('Server replied with length not divisible by 4');
        }
        // TODO Check salt,sessionId, and sequenceNumber
        if (!this._isCall) {
            const keyId = Helpers.readBigIntFromBuffer(body.slice(0, 8));

            if (keyId.neq(this.authKey.keyId)) {
                throw new SecurityError('Server replied with an invalid auth key');
            }
        }
        const msgKey = this._isCall ? body.slice(0, 16) : body.slice(8, 24);

        const x = this._isCall ? 128 + (this.isOutgoing ? 8 : 0) : undefined;
        const {
            iv,
            key,
        } = await this._calcKey(this.authKey.getKey(), msgKey, false);

        if (this._isCall) {
            body = body.slice(16);
            const lengthStart = body.length;

            body = Buffer.concat([body, Buffer.from(new Array(4 - (lengthStart % 4)).fill(0))]);

            body = Helpers.convertToLittle(new aes.CTR(key, iv).decrypt(body));

            body = body.slice(0, lengthStart);
        } else {
            body = new IGE(key, iv).decryptIge(this._isCall ? body.slice(16) : body.slice(24));
        }
        // https://core.telegram.org/mtproto/security_guidelines
        // Sections "checking sha256 hash" and "message length"

        const ourKey = this._isCall
            ? await Helpers.sha256(Buffer.concat([this.authKey.getKey()
                .slice(88 + x, 88 + x + 32), body]))
            : await Helpers.sha256(Buffer.concat([this.authKey.getKey()
                .slice(96, 96 + 32), body]));

        if (!this._isCall && !msgKey.equals(ourKey.slice(8, 24))) {
            throw new SecurityError('Received msg_key doesn\'t match with expected one');
        }
        const reader = new BinaryReader(body);

        if (this._isCall) {
            // Seq
            reader.readInt(false);
            return reader.read(body.length - 4);
        } else {
            reader.readLong(); // removeSalt
            const serverId = reader.readLong();
            if (!serverId.eq(this.id)) {
                throw new SecurityError('Server replied with a wrong session ID');
            }

            const remoteMsgId = reader.readLong();
            // if we get a duplicate message id we should ignore it.
            if (this.msgIds.includes(remoteMsgId.toString())) {
                throw new SecurityError('Duplicate msgIds');
            }
            // we only store the latest 500 message ids from the server
            if (this.msgIds.length > 500) {
                this.msgIds.shift();
            }
            this.msgIds.push(remoteMsgId.toString());
            const remoteSequence = reader.readInt();
            const containerLen = reader.readInt(); // msgLen for the inner object, padding ignored
            const diff = body.length - containerLen;
            // We want to check if it's between 12 and 1024
            // https://core.telegram.org/mtproto/security_guidelines#checking-message-length
            if (diff < 12 || diff > 1024) {
                throw new SecurityError('Server replied with the wrong message padding');
            }

            // We could read msg_len bytes and use those in a new reader to read
            // the next TLObject without including the padding, but since the
            // reader isn't used for anything else after this, it's unnecessary.
            const obj = reader.tgReadObject();

            return new TLMessage(remoteMsgId, remoteSequence, obj);
        }
    }

    /**
     * Generates a new unique message ID based on the current
     * time (in ms) since epoch, applying a known time offset.
     * @private
     */
    _getNewMsgId() {
        const now = new Date().getTime() / 1000 + this.timeOffset;
        const nanoseconds = Math.floor((now - Math.floor(now)) * 1e9);
        let newMsgId = (BigInt(Math.floor(now))
            .shiftLeft(BigInt(32))).or(BigInt(nanoseconds)
            .shiftLeft(BigInt(2)));
        if (this._lastMsgId.greaterOrEquals(newMsgId)) {
            newMsgId = this._lastMsgId.add(BigInt(4));
        }
        this._lastMsgId = newMsgId;
        return newMsgId;
    }

    /**
     * Updates the time offset to the correct
     * one given a known valid message ID.
     * @param correctMsgId {BigInteger}
     */
    updateTimeOffset(correctMsgId) {
        const bad = this._getNewMsgId();
        const old = this.timeOffset;
        const now = Math.floor(new Date().getTime() / 1000);
        const correct = correctMsgId.shiftRight(BigInt(32));
        this.timeOffset = correct - now;

        if (this.timeOffset !== old) {
            this._lastMsgId = BigInt(0);
            this._log.debug(
                `Updated time offset (old offset ${old}, bad ${bad}, good ${correctMsgId}, new ${this.timeOffset})`,
            );
        }

        return this.timeOffset;
    }

    /**
     * Generates the next sequence number depending on whether
     * it should be for a content-related query or not.
     * @param contentRelated
     * @private
     */
    _getSeqNo(contentRelated) {
        if (contentRelated) {
            const result = this._sequence * 2 + 1;
            this._sequence += 1;
            return result;
        } else {
            return this._sequence * 2;
        }
    }
}

module.exports = MTProtoState;
