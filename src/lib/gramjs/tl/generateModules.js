const fs = require('fs');
const path = require('path');

require('./types-generator/generate');

function main() {
    const args = process.argv.slice(2);
    const FULL_SCHEMA = args.length && args[0] === 'full';

    const apiTl = fs.readFileSync(
        path.resolve(__dirname, `./static/api${!FULL_SCHEMA ? '.reduced' : ''}.tl`),
        'utf-8',
    );
    fs.writeFileSync(
        path.resolve(__dirname, './apiTl.js'),
        `module.exports = \`${stripTl(apiTl)}\`;`,
    );

    const schemaTl = fs.readFileSync(
        path.resolve(__dirname, `./static/schema${!FULL_SCHEMA ? '.reduced' : ''}.tl`),
        'utf-8',
    );
    fs.writeFileSync(
        path.resolve(__dirname, './schemaTl.js'),
        `module.exports = \`${stripTl(schemaTl)}\`;`,
    );
}

function stripTl(tl) {
    return tl.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
        .replace(/\n\s*\n/g, '\n')
        .replace(/`/g, '\\`');
}

main();
