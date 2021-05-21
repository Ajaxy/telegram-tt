const { EventBuilder } = require('./common');

class Raw extends EventBuilder {
    constructor(args = {
        types: undefined,
        func: undefined,
    }) {
        super();
        if (!args.types) {
            this.types = true;
        } else {
            this.types = args.types;
        }
    }

    build(update) {
        return update;
    }
}

module.exports = Raw;
