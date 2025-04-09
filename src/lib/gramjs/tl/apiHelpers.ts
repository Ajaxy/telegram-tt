import type { BinaryReader } from '../extensions';

import tlContent from './apiTl';
import {
    type GenerationArgConfig, type GenerationEntryConfig, parseTl, serializeBytes, serializeDate,
} from './generationHelpers';
import schemeContent from './schemaTl';

import { toSignedLittleBuffer } from '../Helpers';

// eslint-disable-next-line no-restricted-globals
const CACHING_SUPPORTED = typeof self !== 'undefined' && self.localStorage !== undefined;

const CACHE_KEY = 'GramJs:apiCache';

type UnsaveVirtualClass = Record<string, any>;

export function buildApiFromTlSchema() {
    let definitions;
    const fromCache = CACHING_SUPPORTED && loadFromCache();

    if (fromCache) {
        definitions = fromCache;
    } else {
        definitions = loadFromTlSchemas();

        if (CACHING_SUPPORTED) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(definitions));
        }
    }

    return mergeWithNamespaces(
        createClasses('constructor', definitions.constructors),
        createClasses('request', definitions.requests),
    );
}

function loadFromCache(): { constructors: GenerationEntryConfig[]; requests: GenerationEntryConfig[] } {
    const jsonCache = localStorage.getItem(CACHE_KEY);
    return jsonCache && JSON.parse(jsonCache);
}

function loadFromTlSchemas() {
    const [constructorParamsApi, functionParamsApi] = extractParams(tlContent);
    const [constructorParamsSchema, functionParamsSchema] = extractParams(schemeContent);
    const constructors = ([] as GenerationEntryConfig[]).concat(constructorParamsApi, constructorParamsSchema);
    const requests = ([] as GenerationEntryConfig[]).concat(functionParamsApi, functionParamsSchema);

    return {
        constructors,
        requests,
    };
}

function mergeWithNamespaces<T extends unknown>(obj1: Record<string, T>, obj2: Record<string, T>): Record<string, T> {
    const result: Record<string, any> = { ...obj1 };

    Object.keys(obj2)
        .forEach((key) => {
            if (typeof obj2[key] === 'function' || !result[key]) {
                result[key] = obj2[key];
            } else {
                Object.assign(result[key], obj2[key]);
            }
        });

    return result;
}

function extractParams(fileContent: string) {
    const f = parseTl(fileContent);
    const constructors = [];
    const functions = [];
    for (const d of f) {
        if (d.isFunction) {
            functions.push(d);
        } else {
            constructors.push(d);
        }
    }
    return [constructors, functions];
}

function argToBytes(x: any, type: string) {
    switch (type) {
        case 'int': {
            const i = Buffer.alloc(4);
            i.writeInt32LE(x, 0);
            return i;
        }
        case 'long':
            return toSignedLittleBuffer(x, 8);
        case 'int128':
            return toSignedLittleBuffer(x, 16);
        case 'int256':
            return toSignedLittleBuffer(x, 32);
        case 'double': {
            const d = Buffer.alloc(8);
            d.writeDoubleLE(x, 0);
            return d;
        }
        case 'string':
            return serializeBytes(x);
        case 'Bool':
            return x ? Buffer.from('b5757299', 'hex') : Buffer.from('379779bc', 'hex');
        case 'true':
            return Buffer.alloc(0);
        case 'bytes':
            return serializeBytes(x);
        case 'date':
            return serializeDate(x);
        default:
            return x.getBytes();
    }
}

function getArgFromReader(reader: BinaryReader, arg: GenerationArgConfig): any {
    if (arg.isVector) {
        if (arg.useVectorId) {
            reader.readInt();
        }
        const temp = [];
        const len = reader.readInt();
        arg.isVector = false;
        for (let i = 0; i < len; i++) {
            temp.push(getArgFromReader(reader, arg));
        }
        arg.isVector = true;
        return temp;
    } else if (arg.flagIndicator) {
        return reader.readInt();
    } else {
        switch (arg.type) {
            case 'int':
                return reader.readInt();
            case 'long':
                return reader.readLong();
            case 'int128':
                return reader.readLargeInt(128);
            case 'int256':
                return reader.readLargeInt(256);
            case 'double':
                return reader.readDouble();
            case 'string':
                return reader.tgReadString();
            case 'Bool':
                return reader.tgReadBool();
            case 'true':
                return true;
            case 'bytes':
                return reader.tgReadBytes();
            case 'date':
                return reader.tgReadDate();
            default:
                if (!arg.skipConstructorId) {
                    return reader.tgReadObject();
                } else {
                    throw new Error(`Unknown type ${arg}`);
                }
        }
    }
}

function createClasses(classesType: 'constructor' | 'request', params: GenerationEntryConfig[]) {
    const classes: Record<string, any> = {};
    for (const classParams of params) {
        const {
            name,
            constructorId,
            subclassOfId,
            argsConfig,
            namespace,
            result,
        } = classParams;
        const fullName = [namespace, name].join('.')
            .replace(/^\./, '');

        class VirtualClass {
            static CONSTRUCTOR_ID = constructorId;

            static SUBCLASS_OF_ID = subclassOfId;

            static className = fullName;

            static classType = classesType;

            CONSTRUCTOR_ID = constructorId;

            SUBCLASS_OF_ID = subclassOfId;

            className = fullName;

            classType = classesType;

            constructor(args: Record<string, any>) {
                args = args || {};
                Object.keys(args)
                    .forEach((argName) => {
                        (this as UnsaveVirtualClass)[argName] = args[argName];
                    });
            }

            static fromReader(reader: BinaryReader) {
                const args: Record<string, any> = {};

                for (const argName in argsConfig) {
                    if (argsConfig.hasOwnProperty(argName)) {
                        const arg = argsConfig[argName];
                        if (arg.isFlag) {
                            const flagGroupSuffix = arg.flagGroup > 1 ? arg.flagGroup : '';
                            const flagValue = args[`flags${flagGroupSuffix}`] & (1 << arg.flagIndex);
                            if (arg.type === 'true') {
                                args[argName] = Boolean(flagValue);
                                continue;
                            }

                            args[argName] = flagValue ? getArgFromReader(reader, arg) : undefined;
                        } else {
                            args[argName] = getArgFromReader(reader, arg);
                        }
                    }
                }
                return new VirtualClass(args);
            }

            getBytes() {
                // The next is pseudo-code:
                const idForBytes = this.CONSTRUCTOR_ID;
                const c = Buffer.alloc(4);
                c.writeUInt32LE(idForBytes, 0);
                const buffers = [c];
                for (const arg in argsConfig) {
                    if (argsConfig.hasOwnProperty(arg)) {
                        if (argsConfig[arg].isFlag) {
                            if (((this as UnsaveVirtualClass)[arg] === false && argsConfig[arg].type === 'true')
                                || (this as UnsaveVirtualClass)[arg] === undefined) {
                                continue;
                            }
                        }
                        if (argsConfig[arg].isVector) {
                            if (argsConfig[arg].useVectorId) {
                                buffers.push(Buffer.from('15c4b51c', 'hex'));
                            }
                            const l = Buffer.alloc(4);
                            l.writeInt32LE((this as UnsaveVirtualClass)[arg].length, 0);
                            buffers.push(l, Buffer.concat((this as UnsaveVirtualClass)[arg].map((x: any) => (
                                argToBytes(x, argsConfig[arg].type)
                            ))));
                        } else if (argsConfig[arg].flagIndicator) {
                            if (!Object.values(argsConfig)
                                .some((f) => f.isFlag)) {
                                buffers.push(Buffer.alloc(4));
                            } else {
                                let flagCalculate = 0;
                                for (const f in argsConfig) {
                                    if (argsConfig[f].isFlag) {
                                        if (((this as UnsaveVirtualClass)[f] === false && argsConfig[f].type === 'true')
                                            || (this as UnsaveVirtualClass)[f] === undefined) {
                                            flagCalculate |= 0;
                                        } else {
                                            flagCalculate |= 1 << argsConfig[f].flagIndex;
                                        }
                                    }
                                }
                                const f = Buffer.alloc(4);
                                f.writeUInt32LE(flagCalculate, 0);
                                buffers.push(f);
                            }
                        } else {
                            buffers.push(argToBytes((this as UnsaveVirtualClass)[arg], argsConfig[arg].type));

                            if ((this as UnsaveVirtualClass)[arg]
                                && typeof (this as UnsaveVirtualClass)[arg].getBytes === 'function') {
                                const firstChar = (argsConfig[arg].type.charAt(argsConfig[arg].type.indexOf('.') + 1));
                                const boxed = firstChar === firstChar.toUpperCase();
                                if (!boxed) {
                                    buffers.shift();
                                }
                            }
                        }
                    }
                }
                return Buffer.concat(buffers);
            }

            readResult(reader: BinaryReader) {
                if (classesType !== 'request') {
                    throw new Error('`readResult()` called for non-request instance');
                }

                const m = result.match(/Vector<(int|long)>/);
                if (m) {
                    reader.readInt();
                    const temp = [];
                    const len = reader.readInt();
                    if (m[1] === 'int') {
                        for (let i = 0; i < len; i++) {
                            temp.push(reader.readInt());
                        }
                    } else {
                        for (let i = 0; i < len; i++) {
                            temp.push(reader.readLong());
                        }
                    }
                    return temp;
                } else {
                    return reader.tgReadObject();
                }
            }
        }

        if (namespace) {
            if (!classes[namespace]) {
                classes[namespace] = {};
            }
            classes[namespace][name] = VirtualClass;
        } else {
            classes[name] = VirtualClass;
        }
    }

    return classes;
}
