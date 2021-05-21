/**
 * Base class for all Remote Procedure Call errors.
 */
class RPCError extends Error {
    constructor(message, request, code = undefined) {
        super(
            'RPCError {0}: {1}{2}'
                .replace('{0}', code)
                .replace('{1}', message)
                .replace('{2}', RPCError._fmtRequest(request)),
        );
        this.code = code;
        this.message = message;
    }

    static _fmtRequest(request) {
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
class InvalidDCError extends RPCError {
    constructor(request, message, code) {
        super(message, request, code);
        this.code = code || 303;
        this.message = message || 'ERROR_SEE_OTHER';
    }
}

/**
 * The query contains errors. In the event that a request was created
 * using a form and contains user generated data, the user should be
 * notified that the data must be corrected before the query is repeated.
 */
class BadRequestError extends RPCError {
    code = 400;

    message = 'BAD_REQUEST';
}

/**
 * There was an unauthorized attempt to use functionality available only
 * to authorized users.
 */
class UnauthorizedError extends RPCError {
    code = 401;

    message = 'UNAUTHORIZED';
}

/**
 * Privacy violation. For example, an attempt to write a message to
 * someone who has blacklisted the current user.
 */
class ForbiddenError extends RPCError {
    code = 403;

    message = 'FORBIDDEN';
}

/**
 * An attempt to invoke a non-existent object, such as a method.
 */
class NotFoundError extends RPCError {
    code = 404;

    message = 'NOT_FOUND';
}

/**
 * Errors related to invalid authorization key, like
 * AUTH_KEY_DUPLICATED which can cause the connection to fail.
 */
class AuthKeyError extends RPCError {
    code = 406;

    message = 'AUTH_KEY';
}

/**
 * The maximum allowed number of attempts to invoke the given method
 * with the given input parameters has been exceeded. For example, in an
 * attempt to request a large number of text messages (SMS) for the same
 * phone number.
 */
class FloodError extends RPCError {
    code = 420;

    message = 'FLOOD';
}

/**
 * An internal server error occurred while a request was being processed
 * for example, there was a disruption while accessing a database or file
 * storage
 */
class ServerError extends RPCError {
    code = 500; // Also witnessed as -500

    message = 'INTERNAL';
}

/**
 * Clicking the inline buttons of bots that never (or take to long to)
 * call ``answerCallbackQuery`` will result in this "special" RPCError.
 */
class TimedOutError extends RPCError {
    code = 503; // Only witnessed as -503

    message = 'Timeout';
}

module.exports = {
    RPCError,
    InvalidDCError,
    BadRequestError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    AuthKeyError,
    FloodError,
    ServerError,
    TimedOutError,
};
