/* eslint-disable @stylistic/max-len */
/* eslint-disable @typescript-eslint/indent */
/* eslint-disable indent */

import type { GenerationArgConfig, GenerationEntryConfig } from '../generationHelpers';
import type { GenerationType } from './generate';

// Not sure what they are for.
const RAW_TYPES = new Set(['Bool', 'X']);

const FLAG_REGEX = /flags\d*/;

const generate = ({
    types,
    constructors,
    functions,
}: {
    types: GenerationType[];
    constructors: GenerationEntryConfig[];
    functions: GenerationEntryConfig[];
}) => {
    function groupByKey<T, K extends keyof T>(list: T[], key: K) {
        return list.reduce((previous, currentItem) => {
          const group = currentItem[key] as string || '_';
          if (!previous[group]) previous[group] = [];
          previous[group].push(currentItem);
          return previous;
        }, {} as Record<string, T[]>);
    }

    function isFlagArg(argName: string) {
        return argName.match(FLAG_REGEX);
    }

    function renderTypes(arr: GenerationType[], indent: string) {
        return arr.map(({ name, constructors: typeConstructors }) => `
      ${!typeConstructors.length ? '// ' : ''}export type Type${upperFirst(name)} = ${typeConstructors.map((n) => n)
            .join(' | ')};
    `.trim())
            .join(`\n${indent}`);
    }

    function renderConstructors(arr: GenerationEntryConfig[], indent: string) {
        return arr.map(({ name, subclassOfId, constructorId, argsConfig }) => {
            const argKeys = Object.keys(argsConfig);
            const defaultHead = `${indent}  CONSTRUCTOR_ID: ${constructorId};
${indent}  SUBCLASS_OF_ID: ${subclassOfId};
${indent}  className: '${name}';\n`;

            if (!argKeys.length) {
                return `export class ${upperFirst(name)} extends VirtualClass<void> {
${defaultHead}
${indent}  static fromReader(reader: Reader): ${upperFirst(name)};
${indent}}`;
            }

            const hasRequiredArgs = argKeys.some((argName) => !isFlagArg(argName) && !argsConfig[argName].isFlag);

            return `
      export class ${upperFirst(name)} extends VirtualClass<{
${indent}  ${Object.keys(argsConfig)
            .map((argName) => `
        ${renderArg(argName, argsConfig[argName])};
      `.trim())
            .join(`\n${indent}  `)}
${indent}}${!hasRequiredArgs ? ' | void' : ''}> {
${indent}  ${Object.keys(argsConfig)
            .map((argName) => `
        ${renderArg(argName, argsConfig[argName])};
      `.trim())
            .join(`\n${indent}  `)}
${defaultHead}
${indent}  static fromReader(reader: Reader): ${upperFirst(name)};
${indent}}`.trim();
        })
        .join(`\n${indent}`);
    }

    function renderRequests(requests: GenerationEntryConfig[], indent: string) {
        return requests.map(({ name, argsConfig, result }) => {
            const argKeys = Object.keys(argsConfig);
            const renderedResult = renderResult(result);

            if (!argKeys.length) {
                return `export class ${upperFirst(name)} extends Request<void, ${renderedResult}> {}`;
            }

            const hasRequiredArgs = argKeys.some((argName) => !isFlagArg(argName) && !argsConfig[argName].isFlag);

            return `
      export class ${upperFirst(name)} extends Request<{
${indent}  ${argKeys.map((argName) => `
        ${renderArg(argName, argsConfig[argName])};
      `.trim())
            .join(`\n${indent}  `)}
${indent}}${!hasRequiredArgs ? ' | void' : ''}, ${renderedResult}> {
${indent}  ${argKeys.map((argName) => `
        ${renderArg(argName, argsConfig[argName])};
      `.trim())
            .join(`\n${indent}  `)}
${indent}}`.trim();
        })
        .join(`\n${indent}`);
    }

    function renderResult(result: string) {
        const vectorMatch = result.match(/[Vv]ector<([\w\d.]+)>/);
        const isVector = Boolean(vectorMatch);
        const scalarValue = isVector ? vectorMatch[1] : result;
        const isTlType = Boolean(scalarValue.match(/^[A-Z]/)) || scalarValue.includes('.');

        return renderValueType(scalarValue, isVector, isTlType);
    }

    function renderArg(argName: string, argConfig: GenerationArgConfig) {
        const {
            isVector, isFlag, skipConstructorId, type,
        } = argConfig;

        const valueType = renderValueType(type, isVector, !skipConstructorId);

        return `${isFlagArg(argName) ? '// ' : ''}${argName}${isFlag ? '?' : ''}: ${valueType}`;
    }

    function renderValueType(type: string, isVector?: boolean, isTlType?: boolean) {
        if (RAW_TYPES.has(type)) {
            return isVector ? `${type}[]` : type;
        }

        let resType;

        if (typeof type === 'string' && isTlType) {
            resType = renderTypeName(type);
        } else {
            resType = type;
        }

        if (isVector) {
            resType = `${resType}[]`;
        }

        return resType;
    }

    function renderTypeName(typeName: string) {
        return typeName.includes('.') ? typeName.replace('.', '.Type') : `Api.Type${typeName}`;
    }

    function upperFirst(str: string) {
        return `${str[0].toUpperCase()}${str.slice(1)}`;
    }

    const typesByNs = groupByKey(types, 'namespace');
    const constructorsByNs = groupByKey(constructors, 'namespace');
    const requestsByNs = groupByKey(functions, 'namespace');

    // language=TypeScript
    return `
// This file is autogenerated. All changes will be overwritten.

export default Api;

namespace Api {

  type AnyClass = new (...args: any[]) => any;
  type I<T extends AnyClass> = InstanceType<T>;
  type ValuesOf<T> = T[keyof T];
  type AnyLiteral = Record<string, any> | void;

  type Reader = any; // To be defined.
  type Client = any; // To be defined.
  type Utils = any; // To be defined.

  type X = unknown;
  type Type = unknown;
  type Bool = boolean;
  type int = number;
  type double = number;
  type int128 = bigint;
  type int256 = bigint;
  type long = bigint;
  type bytes = Buffer<ArrayBuffer>;

  class VirtualClass<Args extends AnyLiteral> {
    static CONSTRUCTOR_ID: number;
    static SUBCLASS_OF_ID: number;
    static className: string;
    static classType: 'constructor' | 'request';

    static serializeBytes(data: Buffer<ArrayBuffer> | string): Buffer<ArrayBuffer>;

    getBytes(): Buffer<ArrayBuffer>;
    CONSTRUCTOR_ID: number;
    SUBCLASS_OF_ID: number;
    className: string;
    classType: 'constructor' | 'request';

    constructor(args: Args);
  }

  class Request<Args, Response> extends VirtualClass<Args> {
    static readResult(reader: Reader): Buffer<ArrayBuffer>;

    __response: Response;
  }

  ${renderTypes(typesByNs._, '  ')}
  ${Object.keys(typesByNs)
        .map((namespace) => (namespace !== '_' ? `
  export namespace ${namespace} {
    ${renderTypes(typesByNs[namespace], '    ')}
  }` : ''))
        .join('\n')}

  ${renderConstructors(constructorsByNs._, '  ')}
  ${Object.keys(constructorsByNs)
        .map((namespace) => (namespace !== '_' ? `
  export namespace ${namespace} {
    ${renderConstructors(constructorsByNs[namespace], '    ')}
  }` : ''))
        .join('\n')}

  ${renderRequests(requestsByNs._, '  ')}
  ${Object.keys(requestsByNs)
        .map((namespace) => (namespace !== '_' ? `
  export namespace ${namespace} {
    ${renderRequests(requestsByNs[namespace], '    ')}
  }` : ''))
        .join('\n')}

  export type AnyRequest = ${requestsByNs._.map(({ name }) => upperFirst(name))
        .join(' | ')}
    | ${Object.keys(requestsByNs)
        .filter((ns) => ns !== '_')
        .map((ns) => requestsByNs[ns].map(({ name }) => `${ns}.${upperFirst(name)}`)
            .join(' | '))
        .join('\n    | ')};

}
`;
};

export default generate;
