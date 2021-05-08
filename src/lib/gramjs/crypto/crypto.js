const AES = require('@cryptography/aes').default;
const {
    i2ab,
    ab2i,
} = require('./converters');
const { getWords } = require('./words');

class Counter {
    constructor(initialValue) {
        this.setBytes(initialValue);
    }

    setBytes(bytes) {
        bytes = Buffer.from(bytes);
        this._counter = bytes;
    }

    increment() {
        for (let i = 15; i >= 0; i--) {
            if (this._counter[i] === 255) {
                this._counter[i] = 0;
            } else {
                this._counter[i]++;
                break;
            }
        }
    }
}

class CTR {
    constructor(key, counter) {
        if (!(counter instanceof Counter)) {
            counter = new Counter(counter);
        }

        this._counter = counter;

        this._remainingCounter = null;
        this._remainingCounterIndex = 16;

        this._aes = new AES(getWords(key));
    }

    update(plainText) {
        return this.encrypt(plainText);
    }

    encrypt(plainText) {
        const encrypted = Buffer.from(plainText);

        for (let i = 0; i < encrypted.length; i++) {
            if (this._remainingCounterIndex === 16) {
                this._remainingCounter = Buffer.from(i2ab(this._aes.encrypt(ab2i(this._counter._counter))));
                this._remainingCounterIndex = 0;
                this._counter.increment();
            }
            encrypted[i] ^= this._remainingCounter[this._remainingCounterIndex++];
        }

        return encrypted;
    }
}

// endregion
function createDecipheriv(algorithm, key, iv) {
    if (algorithm.includes('ECB')) {
        throw new Error('Not supported');
    } else {
        return new CTR(key, iv);
    }
}

function createCipheriv(algorithm, key, iv) {
    if (algorithm.includes('ECB')) {
        throw new Error('Not supported');
    } else {
        return new CTR(key, iv);
    }
}

function randomBytes(count) {
    const bytes = new Uint8Array(count);
    crypto.getRandomValues(bytes);
    return bytes;
}

class Hash {
    constructor(algorithm) {
        this.algorithm = algorithm;
    }

    update(data) {
        // We shouldn't be needing new Uint8Array but it doesn't
        // work without it
        this.data = new Uint8Array(data);
    }

    async digest() {
        if (this.algorithm === 'sha1') {
            return Buffer.from(await self.crypto.subtle.digest('SHA-1', this.data));
        } else if (this.algorithm === 'sha256') {
            return Buffer.from(await self.crypto.subtle.digest('SHA-256', this.data));
        }
    }
}

async function pbkdf2(password, salt, iterations) {
    const passwordKey = await crypto.subtle.importKey('raw', password,
        { name: 'PBKDF2' }, false, ['deriveBits']);
    return Buffer.from(await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        hash: 'SHA-512',
        salt,
        iterations,
    }, passwordKey, 512));
}

function createHash(algorithm) {
    return new Hash(algorithm);
}

module.exports = {
    createCipheriv,
    createDecipheriv,
    randomBytes,
    createHash,
    pbkdf2,
};
