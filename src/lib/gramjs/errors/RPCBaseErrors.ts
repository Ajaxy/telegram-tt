import type { Api } from '../tl';

/**
 * Base class for all Remote Procedure Call errors.
 */
export class RPCError extends Error {
    public code: number | undefined;

    public errorMessage: string;

    constructor(message: string, request: Api.AnyRequest, code?: number) {
        super(
            'RPCError {0}: {1}{2}'
                .replace('{0}', code?.toString() || '')
                .replace('{1}', message)
                .replace('{2}', RPCError._fmtRequest(request)),
        );
        this.code = code;
        this.errorMessage = message;
    }

    static _fmtRequest(request: Api.AnyRequest) {
        // TODO fix this
        if (request) {
            return ` (caused by ${request.className})`;
        } else {
            return '';
        }
    }
}

/**
 * The request must be repeated, but directed to a different data center.
 */
export class InvalidDCError extends RPCError {
    constructor(message: string, request: Api.AnyRequest, code?: number) {
        super(message, request, code);
        this.code = code || 303;
        this.errorMessage = message || 'ERROR_SEE_OTHER';
    }
}

/**
 * The query contains errors. In the event that a request was created
 * using a form and contains user generated data, the user should be
 * notified that the data must be corrected before the query is repeated.
 */
export class BadRequestError extends RPCError {
    code = 400;

    errorMessage = 'BAD_REQUEST';
}

/**
 * There was an unauthorized attempt to use functionality available only
 * to authorized users.
 */
export class UnauthorizedError extends RPCError {
    code = 401;

    errorMessage = 'UNAUTHORIZED';
}

/**
 * Privacy violation. For example, an attempt to write a message to
 * someone who has blacklisted the current user.
 */
export class ForbiddenError extends RPCError {
    code = 403;

    errorMessage = 'FORBIDDEN';
}

/**
 * An attempt to invoke a non-existent object, such as a method.
 */
export class NotFoundError extends RPCError {
    code = 404;

    errorMessage = 'NOT_FOUND';
}

/**
 * Errors related to invalid authorization key, like
 * AUTH_KEY_DUPLICATED which can cause the connection to fail.
 */
export class AuthKeyError extends RPCError {
    code = 406;

    errorMessage = 'AUTH_KEY';
}

/**
 * The maximum allowed number of attempts to invoke the given method
 * with the given input parameters has been exceeded. For example, in an
 * attempt to request a large number of text messages (SMS) for the same
 * phone number.
 */
export class FloodError extends RPCError {
    code = 420;

    errorMessage = 'FLOOD';
}

/**
 * An internal server error occurred while a request was being processed
 * for example, there was a disruption while accessing a database or file
 * storage
 */
export class ServerError extends RPCError {
    code = 500; // Also witnessed as -500

    errorMessage = 'INTERNAL';
}

/**
 * Clicking the inline buttons of bots that never (or take to long to)
 * call ``answerCallbackQuery`` will result in this "special" RPCError.
 */
export class TimedOutError extends RPCError {
    code = 503; // Only witnessed as -503

    errorMessage = 'Timeout';
}
