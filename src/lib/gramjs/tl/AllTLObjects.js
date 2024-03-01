const api = require('./api');

const LAYER = 174;
const tlobjects = {};

for (const tl of Object.values(api)) {
    if (tl.CONSTRUCTOR_ID) {
        tlobjects[tl.CONSTRUCTOR_ID] = tl;
    } else {
        for (const sub of Object.values(tl)) {
            tlobjects[sub.CONSTRUCTOR_ID] = sub;
        }
    }
}

module.exports = {
    LAYER,
    tlobjects,
};
