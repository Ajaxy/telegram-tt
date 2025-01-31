/**
 * Errors not related to the Telegram API itself
 */

import type { Api } from '../tl';

/**
 * Occurs when a read operation was cancelled.
 */
export class ReadCancelledError extends Error {
    constructor() {
        super('The read operation was cancelled.');
    }
}

/**
 * Occurs when a type is not found, for example,
 * when trying to read a TLObject with an invalid constructor code.
 */
export class TypeNotFoundError extends Error {
    invalidConstructorId: number;

    remaining: Buffer;

    constructor(invalidConstructorId: number, remaining: Buffer) {
        super(`Could not find a matching Constructor ID for the TLObject that was supposed to be
        read with ID ${invalidConstructorId}. Most likely, a TLObject was trying to be read when
         it should not be read. Remaining bytes: ${remaining.length}`);
        if (typeof alert !== 'undefined') {
            // eslint-disable-next-line no-alert
            alert(`Missing MTProto Entity: Please, make sure to add TL definition for ID ${invalidConstructorId}`);
        }
        this.invalidConstructorId = invalidConstructorId;
        this.remaining = remaining;
    }
}

/**
 * Occurs when using the TCP full mode and the checksum of a received
 * packet doesn't match the expected checksum.
 */
export class InvalidChecksumError extends Error {
    checksum: number;

    validChecksum: number;

    constructor(checksum: number, validChecksum: number) {
        super(`Invalid checksum (${checksum} when ${validChecksum} was expected). This packet should be skipped.`);
        this.checksum = checksum;
        this.validChecksum = validChecksum;
    }
}

/**
 * Occurs when the buffer is invalid, and may contain an HTTP error code.
 * For instance, 404 means "forgotten/broken authorization key", while
 */
export class InvalidBufferError extends Error {
    code?: number;

    payload: Buffer;

    constructor(payload: Buffer) {
        let code;
        if (payload.length === 4) {
            code = -payload.readInt32LE(0);
            super(`Invalid response buffer (HTTP code ${code})`);
        } else {
            super(`Invalid response buffer (too short ${payload})`);
        }
        this.code = code;
        this.payload = payload;
    }
}

/**
 * Generic security error, mostly used when generating a new AuthKey.
 */
export class SecurityError extends Error {
    constructor(...args: any[]) {
        if (!args.length) {
            args = ['A security check failed.'];
        }
        super(...args);
    }
}

/**
 * Occurs when there's a hash mismatch between the decrypted CDN file
 * and its expected hash.
 */
export class CdnFileTamperedError extends SecurityError {
    constructor() {
        super('The CDN file has been altered and its download cancelled.');
    }
}

/**
 * Occurs when handling a badMessageNotification
 */
export class BadMessageError extends Error {
    static ErrorMessages: Record<number, string> = {
        16:
            'msg_id too low (most likely, client time is wrong it would be worthwhile to '
            + 'synchronize it using msg_id notifications and re-send the original message '
            + 'with the “correct” msg_id or wrap it in a container with a new msg_id if the '
            + 'original message had waited too long on the client to be transmitted).',

        17:
            'msg_id too high (similar to the previous case, the client time has to be '
            + 'synchronized, and the message re-sent with the correct msg_id).',

        18:
            'Incorrect two lower order msg_id bits (the server expects client message msg_id '
            + 'to be divisible by 4).',

        19: 'Container msg_id is the same as msg_id of a previously received message (this must never happen).',

        20:
            'Message too old, and it cannot be verified whether the server has received a '
            + 'message with this msg_id or not.',

        32:
            'msg_seqno too low (the server has already received a message with a lower '
            + 'msg_id but with either a higher or an equal and odd seqno).',

        33:
            'msg_seqno too high (similarly, there is a message with a higher msg_id but with '
            + 'either a lower or an equal and odd seqno).',

        34: 'An even msg_seqno expected (irrelevant message), but odd received.',

        35: 'Odd msg_seqno expected (relevant message), but even received.',

        48:
            'Incorrect server salt (in this case, the bad_server_salt response is received with '
            + 'the correct salt, and the message is to be re-sent with it).',

        64: 'Invalid container.',
    };

    code: number;

    errorMessage: string;

    constructor(request: Api.AnyRequest, code: number) {
        let errorMessage = BadMessageError.ErrorMessages[code]
            || `Unknown error code (this should not happen): ${code}.`;
        errorMessage += `  Caused by ${request.className}`;
        super(errorMessage);
        this.errorMessage = errorMessage;
        this.code = code;
    }
}

// TODO : Support multi errors.
