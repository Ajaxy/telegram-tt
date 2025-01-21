import fs from 'fs';
import path from 'path';

import './types-generator/generate';

function generateSchema(input: string, output: string, reducedMethods?: string) {
    let apiTl = fs.readFileSync(
        path.resolve(__dirname, input),
        'utf-8',
    );

    if (reducedMethods) {
        apiTl = stripTl(apiTl);
        const methodList: string[] = JSON.parse(fs.readFileSync(
            path.resolve(__dirname, reducedMethods),
            'utf-8',
        ));
        let isFunction = false;
        const reducedApiTl: string[] = [];

        for (const line of apiTl.split('\n')) {
            if (!line) {
                continue;
            }

            const match = line.match(/---(\w+)---/);

            if (match) {
                const [, followingTypes] = match;
                isFunction = followingTypes === 'functions';
                reducedApiTl.push(line);
                continue;
            }

            if (!isFunction) {
                reducedApiTl.push(line);
            } else if (methodList.includes(line.match(/([\w.]+)#/)![1])) {
                reducedApiTl.push(line);
            }
        }
        apiTl = reducedApiTl.join('\n');
    }

    fs.writeFileSync(
        path.resolve(__dirname, output),
        `export default \`${stripTl(apiTl)}\`;`,
    );
}

function main() {
    const args = process.argv.slice(2);
    const FULL_SCHEMA = args.length && args[0] === 'full';

    generateSchema('./static/api.tl', './apiTl.ts', !FULL_SCHEMA ? './static/api.json' : undefined);
    generateSchema('./static/schema.tl', './schemaTl.ts', !FULL_SCHEMA ? './static/schema.json' : undefined);
}

function stripTl(tl: string) {
    return tl.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // Remove comments
        .replace(/\n\s*\n/g, '\n') // Trim & add newline
        .replace(/`/g, '\\`') // Escape backticks
        .replace(/\r/g, ''); // Remove carriage return
}

main();
