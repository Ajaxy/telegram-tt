const {
    RPCError,
    InvalidDCError,
    FloodError,
    BadRequestError,
    TimedOutError,
} = require('./RPCBaseErrors');

class UserMigrateError extends InvalidDCError {
    constructor(args) {
        const newDc = Number(args.capture || 0);
        // eslint-disable-next-line max-len
        super(`The user whose identity is being used to execute queries is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `The user whose identity is being used to execute queries is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
        this.newDc = newDc;
    }
}

class PhoneMigrateError extends InvalidDCError {
    constructor(args) {
        const newDc = Number(args.capture || 0);
        // eslint-disable-next-line max-len
        super(`The phone number a user is trying to use for authorization is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `The phone number a user is trying to use for authorization is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
        this.newDc = newDc;
    }
}

class SlowModeWaitError extends FloodError {
    constructor(args) {
        const seconds = Number(args.capture || 0);
        // eslint-disable-next-line max-len
        super(`A wait of ${seconds} seconds is required before sending another message in this chat${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `A wait of ${seconds} seconds is required before sending another message in this chat${RPCError._fmtRequest(args.request)}`;
        this.seconds = seconds;
    }
}

class FloodWaitError extends FloodError {
    constructor(args) {
        const seconds = Number(args.capture || 0);
        super(`A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`);
        this.message = `A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`;
        this.seconds = seconds;
    }
}
class MsgWaitError extends FloodError {
    constructor(args) {
        super(`Message failed to be sent.${RPCError._fmtRequest(args.request)}`);
        this.message = `Message failed to be sent.${RPCError._fmtRequest(args.request)}`;
    }
}

class FloodTestPhoneWaitError extends FloodError {
    constructor(args) {
        const seconds = Number(args.capture || 0);
        super(`A wait of ${seconds} seconds is required in the test servers${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `A wait of ${seconds} seconds is required in the test servers${RPCError._fmtRequest(args.request)}`;
        this.seconds = seconds;
    }
}

class FileMigrateError extends InvalidDCError {
    constructor(args) {
        const newDc = Number(args.capture || 0);
        super(`The file to be accessed is currently stored in DC ${newDc}${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `The file to be accessed is currently stored in DC ${newDc}${RPCError._fmtRequest(args.request)}`;
        this.newDc = newDc;
    }
}

class NetworkMigrateError extends InvalidDCError {
    constructor(args) {
        const newDc = Number(args.capture || 0);
        super(`The source IP address is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`);
        this.message = `The source IP address is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
        this.newDc = newDc;
    }
}

class EmailUnconfirmedError extends BadRequestError {
    constructor(args) {
        const codeLength = Number(args.capture || 0);
        super(`Email unconfirmed, the length of the code must be ${codeLength}${RPCError._fmtRequest(args.request)}`);
        // eslint-disable-next-line max-len
        this.message = `Email unconfirmed, the length of the code must be ${codeLength}${RPCError._fmtRequest(args.request)}`;
        this.codeLength = codeLength;
    }
}

const rpcErrorRe = [
    [/FILE_MIGRATE_(\d+)/, FileMigrateError],
    [/FLOOD_TEST_PHONE_WAIT_(\d+)/, FloodTestPhoneWaitError],
    [/FLOOD_WAIT_(\d+)/, FloodWaitError],
    [/MSG_WAIT_(.*)/, MsgWaitError],
    [/PHONE_MIGRATE_(\d+)/, PhoneMigrateError],
    [/SLOWMODE_WAIT_(\d+)/, SlowModeWaitError],
    [/USER_MIGRATE_(\d+)/, UserMigrateError],
    [/NETWORK_MIGRATE_(\d+)/, NetworkMigrateError],
    [/EMAIL_UNCONFIRMED_(\d+)/, EmailUnconfirmedError],
    [/^Timeout$/, TimedOutError],
];
module.exports = {
    rpcErrorRe,
    FileMigrateError,
    FloodTestPhoneWaitError,
    FloodWaitError,
    PhoneMigrateError,
    SlowModeWaitError,
    UserMigrateError,
    NetworkMigrateError,
    MsgWaitError,
    EmailUnconfirmedError,
};
