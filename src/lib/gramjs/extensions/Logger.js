// eslint-disable-next-line @typescript-eslint/naming-convention
let _level;

class Logger {
    static LEVEL_MAP = new Map([
        ['error', new Set(['error'])],
        ['warn', new Set(['error', 'warn'])],
        ['info', new Set(['error', 'warn', 'info'])],
        ['debug', new Set(['error', 'warn', 'info', 'debug'])],
    ]);

    constructor(level) {
        if (!_level) {
            _level = level || 'debug';
        }

        this.colors = {
            start: '%c',
            warn: 'color : #ff00ff',
            info: 'color : #ffff00',
            debug: 'color : #00ffff',
            error: 'color : #ff0000',
            end: '',
        };
        this.messageFormat = '[%t] [%l] - [%m]';
    }

    static setLevel(level) {
        _level = level;
    }

    /**
     *
     * @param level {string}
     * @returns {boolean}
     */
    canSend(level) {
        return Logger.LEVEL_MAP.get(_level).has(level);
    }

    /**
     * @param message {string}
     */
    warn(message) {
        this._log('warn', message, this.colors.warn);
    }

    /**
     * @param message {string}
     */
    info(message) {
        this._log('info', message, this.colors.info);
    }

    /**
     * @param message {string}
     */
    debug(message) {
        this._log('debug', message, this.colors.debug);
    }

    /**
     * @param message {string}
     */
    error(message) {
        this._log('error', message, this.colors.error);
    }

    format(message, level) {
        return this.messageFormat.replace('%t', new Date().toISOString())
            .replace('%l', level.toUpperCase())
            .replace('%m', message);
    }

    /**
     * @param level {string}
     * @param message {string}
     * @param color {string}
     */
    _log(level, message, color) {
        if (!_level) {
            return;
        }
        if (this.canSend(level)) {
            // eslint-disable-next-line no-console
            console.log(this.colors.start + this.format(message, level), color);
        }
    }
}

module.exports = Logger;
