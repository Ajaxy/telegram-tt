const MemorySession = require('./Memory');
const AuthKey = require('../crypto/AuthKey');
const BinaryReader = require('../extensions/BinaryReader');

const CURRENT_VERSION = '1';

class StringSession extends MemorySession {
    /**
     * This session file can be easily saved and loaded as a string. According
     * to the initial design, it contains only the data that is necessary for
     * successful connection and authentication, so takeout ID is not stored.

     * It is thought to be used where you don't want to create any on-disk
     * files but would still like to be able to save and load existing sessions
     * by other means.

     * You can use custom `encode` and `decode` functions, if present:

     * `encode` definition must be ``function encode(value: Buffer) -> string:``.
     * `decode` definition must be ``function decode(value: string) -> Buffer:``.
     * @param session {string|null}
     */
    constructor(session = undefined) {
        super();
        if (session) {
            if (session[0] !== CURRENT_VERSION) {
                throw new Error('Not a valid string');
            }
            session = session.slice(1);
            const r = StringSession.decode(session);
            const reader = new BinaryReader(r);
            this._dcId = reader.read(1)
                .readUInt8(0);
            const serverAddressLen = reader.read(2)
                .readInt16BE(0);
            this._serverAddress = String(reader.read(serverAddressLen));
            this._port = reader.read(2)
                .readInt16BE(0);
            this._key = reader.read(-1);
        }
    }

    /**
     * @param x {Buffer}
     * @returns {string}
     */
    static encode(x) {
        return x.toString('base64');
    }

    /**
     * @param x {string}
     * @returns {Buffer}
     */
    static decode(x) {
        return Buffer.from(x, 'base64');
    }

    async load() {
        if (this._key) {
            this._authKey = new AuthKey();
            await this._authKey.setKey(this._key);
        }
    }

    save() {
        if (!this.authKey) {
            return '';
        }
        const dcBuffer = Buffer.from([this.dcId]);
        const addressBuffer = Buffer.from(this.serverAddress);
        const addressLengthBuffer = Buffer.alloc(2);
        addressLengthBuffer.writeInt16BE(addressBuffer.length, 0);
        const portBuffer = Buffer.alloc(2);
        portBuffer.writeInt16BE(this.port, 0);

        return CURRENT_VERSION + StringSession.encode(Buffer.concat([
            dcBuffer,
            addressLengthBuffer,
            addressBuffer,
            portBuffer,
            this.authKey.getKey(),
        ]));
    }

    getAuthKey(dcId) {
        if (dcId && dcId !== this.dcId) {
            // Not supported.
            return undefined;
        }

        return this.authKey;
    }

    setAuthKey(authKey, dcId) {
        if (dcId && dcId !== this.dcId) {
            // Not supported.
            return;
        }

        this.authKey = authKey;
    }
}

module.exports = StringSession;
