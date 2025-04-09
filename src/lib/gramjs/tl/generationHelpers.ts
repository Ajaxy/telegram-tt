import { crc32 } from '../Helpers';

export interface GenerationEntryConfig {
    name: string;
    constructorId: number;
    argsConfig: Record<string, GenerationArgConfig>;
    subclassOfId: number;
    result: string;
    isFunction?: boolean;
    namespace: string | undefined;
}

export interface GenerationArgConfig {
    isVector: boolean;
    isFlag: boolean;
    skipConstructorId: boolean;
    flagGroup: number;
    flagIndex: number;
    flagIndicator: boolean;
    type: string;
    useVectorId: boolean | undefined;
}

const snakeToCamelCase = (name: string) => {
    const result = name.replace(/(?:^|_)([a-z])/g, (_, g) => g.toUpperCase());
    return result.replace(/_/g, '');
};
const variableSnakeToCamelCase = (str: string) => str.replace(
    /([-_][a-z])/g,
    (group) => group.toUpperCase()
        .replace('-', '')
        .replace('_', ''),
);

const CORE_TYPES = new Set([
    0xbc799737, // boolFalse#bc799737 = Bool;
    0x997275b5, // boolTrue#997275b5 = Bool;
    0x3fedd339, // true#3fedd339 = True;
    0xc4b9f9bb, // error#c4b9f9bb code:int text:string = Error;
    0x56730bcc, // null#56730bcc = Null;
]);
const AUTH_KEY_TYPES = new Set([
    0x05162463, // resPQ,
    0x83c95aec, // p_q_inner_data
    0xa9f55f95, // p_q_inner_data_dc
    0x3c6a84d4, // p_q_inner_data_temp
    0x56fddf88, // p_q_inner_data_temp_dc
    0xd0e8075c, // server_DH_params_ok
    0xb5890dba, // server_DH_inner_data
    0x6643b654, // client_DH_inner_data
    0xd712e4be, // req_DH_params
    0xf5045f1f, // set_client_DH_params
    0x3072cfa1, // gzip_packed
]);

const findAll = (regex: RegExp, str: string, matches: string[][] = []) => {
    if (!regex.flags.includes('g')) {
        regex = new RegExp(regex.source, 'g');
    }

    const res = regex.exec(str);

    if (res) {
        matches.push(res.slice(1));
        findAll(regex, str, matches);
    }

    return matches;
};

const fromLine = (line: string, isFunction?: boolean) => {
    const match = line.match(/([\w.]+)(?:#([0-9a-fA-F]+))?(?:\s{?\w+:[\w\d<>#.?!]+}?)*\s=\s([\w\d<>#.?]+);$/);
    if (!match) {
        // Probably "vector#1cb5c415 {t:Type} # [ t ] = Vector t;"
        throw new Error(`Cannot parse TLObject ${line}`);
    }

    const argsMatch = findAll(/({)?(\w+):([\w\d<>#.?!]+)}?/, line);
    const currentConfig: GenerationEntryConfig = {
        name: match[1],
        constructorId: parseInt(match[2], 16),
        argsConfig: {},
        subclassOfId: crc32(match[3]),
        result: match[3],
        isFunction,
        namespace: undefined,
    };
    if (!currentConfig.constructorId) {
        const hexId = '';
        let args;

        if (Object.values(currentConfig.argsConfig).length) {
            args = ` ${Object.keys(currentConfig.argsConfig)
                .map((arg) => arg.toString())
                .join(' ')}`;
        } else {
            args = '';
        }

        const representation = `${currentConfig.name}${hexId}${args} = ${currentConfig.result}`
            .replace(/(:|\?)bytes /g, '$1string ')
            .replace(/</g, ' ')
            .replace(/>|{|}/g, '')
            .replace(/ \w+:flags\d*\.\d+\?true/g, '');

        if (currentConfig.name === 'inputMediaInvoice') {
            // eslint-disable-next-line no-empty
            if (currentConfig.name === 'inputMediaInvoice') {
            }
        }

        currentConfig.constructorId = crc32(Buffer.from(representation, 'utf8'));
    }
    for (const [brace, name, argType] of argsMatch) {
        if (brace === undefined) {
            currentConfig.argsConfig[variableSnakeToCamelCase(name)] = buildArgConfig(name, argType);
        }
    }
    if (currentConfig.name.includes('.')) {
        [currentConfig.namespace, currentConfig.name] = currentConfig.name.split(/\.(.+)/);
    }
    currentConfig.name = snakeToCamelCase(currentConfig.name);
    /*
    for (const arg in currentConfig.argsConfig){
      if (currentConfig.argsConfig.hasOwnProperty(arg)){
        if (currentConfig.argsConfig[arg].flagIndicator){
          delete  currentConfig.argsConfig[arg]
        }
      }
    } */
    return currentConfig;
};

function buildArgConfig(name: string, argType: string) {
    name = name === 'self' ? 'is_self' : name;
    // Default values
    const currentConfig: GenerationArgConfig = {
        isVector: false,
        isFlag: false,
        skipConstructorId: false,
        flagGroup: 0,
        flagIndex: -1,
        flagIndicator: true,
        type: '',
        useVectorId: undefined,
    };

    // The type can be an indicator that other arguments will be flags
    if (argType !== '#') {
        currentConfig.flagIndicator = false;
        // Strip the exclamation mark always to have only the name
        currentConfig.type = argType.replace(/^!+/, '');

        // The type may be a flag (flags[N].IDX?REAL_TYPE)
        // Note that 'flags' is NOT the flags name; this
        // is determined by a previous argument
        // However, we assume that the argument will always be called 'flags[N]'
        const flagMatch = currentConfig.type.match(/flags(\d*)\.(\d+)\?([\w<>.]+)/);

        if (flagMatch) {
            currentConfig.isFlag = true;
            currentConfig.flagGroup = Number(flagMatch[1] || 1);
            currentConfig.flagIndex = Number(flagMatch[2]);
            // Update the type to match the exact type, not the "flagged" one
            [, , , currentConfig.type] = flagMatch;
        }

        // Then check if the type is a Vector<REAL_TYPE>
        const vectorMatch = currentConfig.type.match(/[Vv]ector<([\w\d.]+)>/);

        if (vectorMatch) {
            currentConfig.isVector = true;

            // If the type's first letter is not uppercase, then
            // it is a constructor and we use (read/write) its ID.
            currentConfig.useVectorId = currentConfig.type.charAt(0) === 'V';

            // Update the type to match the one inside the vector
            [, currentConfig.type] = vectorMatch;
        }

        // See use_vector_id. An example of such case is ipPort in
        // help.configSpecial
        if (/^[a-z]$/.test(currentConfig.type.split('.')
            .pop()!
            .charAt(0))
        ) {
            currentConfig.skipConstructorId = true;
        }

        // The name may contain "date" in it, if this is the case and
        // the type is "int", we can safely assume that this should be
        // treated as a "date" object. Note that this is not a valid
        // Telegram object, but it's easier to work with
        // if (
        //     this.type === 'int' &&
        //     (/(\b|_)([dr]ate|until|since)(\b|_)/.test(name) ||
        //         ['expires', 'expires_at', 'was_online'].includes(name))
        // ) {
        //     this.type = 'date';
        // }
    }
    return currentConfig;
}

export function* parseTl(content: string, methods: any[] = [], ignoreIds = CORE_TYPES) {
    (methods || []).reduce((o, m) => ({
        ...o,
        [m.name]: m,
    }), {});
    const objAll: GenerationEntryConfig[] = [];
    const objByName: Record<string, GenerationEntryConfig> = {};
    const objByType: Record<string, GenerationEntryConfig[]> = {};

    const file = content;

    let isFunction = false;

    for (let line of file.split('\n')) {
        const commentIndex = line.indexOf('//');

        if (commentIndex !== -1) {
            line = line.slice(0, commentIndex);
        }

        line = line.trim();

        if (!line) {
            continue;
        }

        const match = line.match(/---(\w+)---/);

        if (match) {
            const [, followingTypes] = match;
            isFunction = followingTypes === 'functions';
            continue;
        }

        try {
            const result = fromLine(line, isFunction);

            if (ignoreIds.has(result.constructorId)) {
                continue;
            }

            objAll.push(result);

            if (!result.isFunction) {
                if (!objByType[result.result]) {
                    objByType[result.result] = [];
                }

                objByName[result.name] = result;
                objByType[result.result].push(result);
            }
        } catch (e: any) {
            if (!e.toString()
                .includes('vector#1cb5c415')) {
                throw e;
            }
        }
    }

    // Once all objects have been parsed, replace the
    // string type from the arguments with references
    for (const obj of objAll) {
        // console.log(obj)
        if (AUTH_KEY_TYPES.has(obj.constructorId)) {
            for (const arg in obj.argsConfig) {
                if (obj.argsConfig[arg].type === 'string') {
                    obj.argsConfig[arg].type = 'bytes';
                }
            }
        }
    }

    for (const obj of objAll) {
        yield obj;
    }
}

export function serializeBytes(data: Buffer | string | any) {
    if (!(data instanceof Buffer)) {
        if (typeof data === 'string') {
            data = Buffer.from(data);
        } else {
            throw Error(`Bytes or str expected, not ${data.constructor.name}`);
        }
    }
    const r = [];
    let padding;
    if (data.length < 254) {
        padding = (data.length + 1) % 4;
        if (padding !== 0) {
            padding = 4 - padding;
        }
        r.push(Buffer.from([data.length]));
        r.push(data);
    } else {
        padding = data.length % 4;
        if (padding !== 0) {
            padding = 4 - padding;
        }
        r.push(Buffer.from([254, data.length % 256, (data.length >> 8) % 256, (data.length >> 16) % 256]));
        r.push(data);
    }
    r.push(Buffer.alloc(padding)
        .fill(0));

    return Buffer.concat(r);
}

export function serializeDate(dt: Date | number) {
    if (!dt) {
        return Buffer.alloc(4)
            .fill(0);
    }
    if (dt instanceof Date) {
        dt = Math.floor((Date.now() - dt.getTime()) / 1000);
    }
    if (typeof dt === 'number') {
        const t = Buffer.alloc(4);
        t.writeInt32LE(dt, 0);
        return t;
    }
    throw Error(`Cannot interpret "${dt}" as a date`);
}
