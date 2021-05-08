const { EventBuilder } = require('./common');

class Raw extends EventBuilder {
    constructor(args = {
        types: null,
        func: null,
    }) {
        super();
        if (!args.types) {
            this.types = true;
        } else {
            this.types = args.types;
        }
    }

    build(update, others = null) {
        return update;
    }
}

module.exports = Raw;
