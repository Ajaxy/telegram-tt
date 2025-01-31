export type LoggerLevel = 'error' | 'warn' | 'info' | 'debug';

// eslint-disable-next-line @typescript-eslint/naming-convention
let _level: LoggerLevel;

type ColorKey = LoggerLevel | 'start' | 'end';

export default class Logger {
    static LEVEL_MAP = new Map<LoggerLevel, Set<LoggerLevel>>([
        ['error', new Set(['error'])],
        ['warn', new Set(['error', 'warn'])],
        ['info', new Set(['error', 'warn', 'info'])],
        ['debug', new Set(['error', 'warn', 'info', 'debug'])],
    ]);

    colors: Record<ColorKey, string>;

    messageFormat: string;

    constructor(level?: LoggerLevel) {
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

    static setLevel(level: LoggerLevel) {
        _level = level;
    }

    canSend(level: LoggerLevel) {
        if (!_level) return false;
        return Logger.LEVEL_MAP.get(_level)!.has(level);
    }

    warn(message: string) {
        this._log('warn', message, this.colors.warn);
    }

    info(message: string) {
        this._log('info', message, this.colors.info);
    }

    debug(message: string) {
        this._log('debug', message, this.colors.debug);
    }

    error(message: string) {
        this._log('error', message, this.colors.error);
    }

    format(message: string, level: LoggerLevel) {
        return this.messageFormat.replace('%t', new Date().toISOString())
            .replace('%l', level.toUpperCase())
            .replace('%m', message);
    }

    _log(level: LoggerLevel, message: string, color: string) {
        if (!_level) {
            return;
        }
        if (this.canSend(level)) {
            // eslint-disable-next-line no-console
            console.log(this.colors.start + this.format(message, level), color);
        }
    }
}
