const crypto = require('./crypto');

class CTR {
    constructor(key, iv) {
        if (!Buffer.isBuffer(key) || !Buffer.isBuffer(iv) || iv.length !== 16) {
            throw new Error('Key and iv need to be a buffer');
        }

        this.cipher = crypto.createCipheriv('AES-256-CTR', key, iv);
    }

    encrypt(data) {
        return Buffer.from(this.cipher.update(data));
    }
}

module.exports = CTR;
