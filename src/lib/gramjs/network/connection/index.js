const { Connection, HttpConnection } = require('./Connection');
const { ConnectionTCPFull } = require('./TCPFull');
const { ConnectionTCPAbridged } = require('./TCPAbridged');
const { ConnectionTCPObfuscated } = require('./TCPObfuscated');

module.exports = {
    Connection,
    HttpConnection,
    ConnectionTCPFull,
    ConnectionTCPAbridged,
    ConnectionTCPObfuscated,
};
