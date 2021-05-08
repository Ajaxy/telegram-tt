/* CONTEST
const { EventBuilder, EventCommon } = require('./common')
const { constructors } = require('../tl')

class NewMessage extends EventBuilder {
    constructor(args = {
        chats: null,
        func: null,
    }) {
        super(args)

        this.chats = args.chats
        this.func = args.func
        this._noCheck = true
    }

    async _resolve(client) {
        await super._resolve(client)
        // this.fromUsers = await _intoIdSet(client, this.fromUsers)
    }

    build(update, others = null, thisId = null) {
        let event
        if (update instanceof constructors.UpdateNewMessage || update instanceof constructors.UpdateNewChannelMessage) {
            if (!(update.message instanceof constructors.Message)) {
                return
            }
            event = new Event(update.message)
        } else if (update instanceof constructors.UpdateShortMessage) {
            event = new Event(new constructors.Message({
                out: update.out,
                mentioned: update.mentioned,
                mediaUnread: update.mediaUnread,
                silent: update.silent,
                id: update.id,
                // Note that to_id/from_id complement each other in private
                // messages, depending on whether the message was outgoing.
                toId: new constructors.PeerUser(update.out ? update.userId : thisId),
                fromId: update.out ? thisId : update.userId,
                message: update.message,
                date: update.date,
                fwdFrom: update.fwdFrom,
                viaBotId: update.viaBotId,
                replyToMsgId: update.replyToMsgId,
                entities: update.entities,
            }))
        } else if (update instanceof constructors.UpdateShortChatMessage) {
            event = new this.Event(new constructors.Message({
                out: update.out,
                mentioned: update.mentioned,
                mediaUnread: update.mediaUnread,
                silent: update.silent,
                id: update.id,
                toId: new constructors.PeerChat(update.chatId),
                fromId: update.fromId,
                message: update.message,
                date: update.date,
                fwdFrom: update.fwdFrom,
                viaBotId: update.viaBotId,
                replyToMsgId: update.replyToMsgId,
                entities: update.entities,
            }))
        } else {
            return
        }

        // Make messages sent to ourselves outgoing unless they're forwarded.
        // This makes it consistent with official client's appearance.
        const ori = event.message
        if (ori.toId instanceof constructors.PeerUser) {
            if (ori.fromId === ori.toId.userId && !ori.fwdFrom) {
                event.message.out = true
            }
        }
        return event
    }

    filter(event) {
        if (this._noCheck) {
            return event
        }
        return event
    }
}

class Event extends EventCommon {
    constructor(message) {
        super()
        this.message = message
    }
}

module.exports = NewMessage
*/
