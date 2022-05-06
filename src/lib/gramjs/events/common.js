class EventBuilder {
    constructor(args = {
        chats: undefined,
        blacklistChats: undefined,
        func: undefined,
    }) {
        this.chats = args.chats;
        this.blacklistChats = Boolean(args.blacklistChats);
        this.resolved = false;
        this.func = args.func;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    build(update) {

    }
}

module.exports = {
    EventBuilder,
};
