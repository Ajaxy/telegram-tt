const MTProtoPlainSender = require('./MTProtoPlainSender')
const doAuthentication = require('./Authenticator')
const MTProtoSender = require('./MTProtoSender')

class UpdateConnectionState {
    static disconnected = -1
    static connected = 1
    static broken = 0

    constructor(state) {
        this.state = state
    }
}

const {
    Connection,
    ConnectionTCPFull,
    ConnectionTCPAbridged,
    ConnectionTCPObfuscated,
} = require('./connection')
module.exports = {
    Connection,
    ConnectionTCPFull,
    ConnectionTCPAbridged,
    ConnectionTCPObfuscated,
    MTProtoPlainSender,
    doAuthentication,
    MTProtoSender,
    UpdateConnectionState,
}
