const fs = require('fs');
const path = require('path');

require('./types-generator/generate');

function main() {
    const apiTl = fs.readFileSync(path.resolve(__dirname, './static/api.reduced.tl'));
    fs.writeFileSync(path.resolve(__dirname, './apiTl.js'), `module.exports = \`${apiTl}\`;`);

    const schemaTl = fs.readFileSync(path.resolve(__dirname, './static/schema.reduced.tl'));
    fs.writeFileSync(path.resolve(__dirname, './schemaTl.js'), `module.exports = \`${schemaTl}\`;`);
}

main();
