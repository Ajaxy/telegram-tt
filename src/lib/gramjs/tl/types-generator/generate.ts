import fs from 'fs';
import path from 'path';

import { parseTl } from '../generationHelpers';
import templateFn from './template';

export type GenerationType = {
    namespace?: string;
    name: string;
    constructors: Array<string>;
};

const INPUT_FILE = path.resolve(__dirname, '../static/api.tl');
const SCHEMA_FILE = path.resolve(__dirname, '../static/schema.tl');

const OUTPUT_FILE = path.resolve(__dirname, '../api.d.ts');

function main() {
    const tlContent = fs.readFileSync(INPUT_FILE, 'utf-8');
    const apiConfig = extractParams(tlContent);
    const schemeContent = fs.readFileSync(SCHEMA_FILE, 'utf-8');
    const schemeConfig = extractParams(schemeContent);
    const types = [...apiConfig.types, ...schemeConfig.types];
    const functions = [...apiConfig.functions, ...schemeConfig.functions];
    const constructors = [...apiConfig.constructors, ...schemeConfig.constructors];
    const generated = templateFn({
        types,
        functions,
        constructors,
    });

    fs.writeFileSync(OUTPUT_FILE, generated);
}

function extractParams(fileContent: string) {
    const defInterator = parseTl(fileContent);
    const types: Record<string, GenerationType> = {};
    const constructors = [];
    const functions = [];

    for (const def of defInterator) {
        if (def.isFunction) {
            functions.push(def);
        } else {
            if (!types[def.result]) {
                const [namespace, name] = def.result.includes('.') ? def.result.split('.') : [undefined, def.result];

                types[def.result] = {
                    namespace,
                    name,
                    constructors: [],
                };
            }

            types[def.result].constructors.push(def.namespace ? `${def.namespace}.${def.name}` : def.name);
            constructors.push(def);
        }
    }

    return {
        types: Object.values(types),
        constructors,
        functions,
    };
}

main();
