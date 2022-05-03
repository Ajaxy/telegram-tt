import BigInt from 'big-integer';
import { UpdateConnectionState } from '../network';
import Request, { default as GramJs } from '../tl/api';

type Peer = {
    peer: GramJs.Chat | GramJs.Channel | GramJs.User;
    TEST_messages: GramJs.Message[];
    TEST_sendMessage: (data: CreateMessageParams) => GramJs.Message | undefined;
};

type CreateMessageParams = {
    fromId?: any;
    repliesChannelId?: any;
    replyingTo?: GramJs.MessageReplyHeader;
};

class TelegramClient {
    addEventHandler(callback: any, event: any) {
        callback(event.build(new UpdateConnectionState(UpdateConnectionState.connected)));
    }

    private lastId = 0;

    private peers: Peer[] = [];

    private dialogs: GramJs.Dialog[] = [];

    start() {
    }

    constructor() {
        const user = this.createUser({
            firstName: 'Test',
            lastName: 'Account',
        });
        user.TEST_sendMessage({});

        const chat = this.createChat({});
        chat.TEST_sendMessage({});

        const channel = this.createChannel({
            title: 'Test Channel',
            username: 'testchannel',
        });

        const discussion = this.createChannel({
            title: 'Test Discussion',
            username: 'testdiscuss',
            isMegagroup: true,
        });

        const message = channel.TEST_sendMessage({
            repliesChannelId: discussion.peer.id,
        });

        const { id } = discussion.TEST_sendMessage({})!;

        discussion.TEST_sendMessage({
            fromId: new GramJs.PeerUser({
                userId: user.peer.id,
            }),
            replyingTo: new GramJs.MessageReplyHeader({
                replyToMsgId: id,
                replyToPeerId: new GramJs.PeerChannel({
                    channelId: channel.peer.id,
                }),
                replyToTopId: message!.id,
            }),
        });
    }

    createDialog(peer: GramJs.TypePeer) {
        return new GramJs.Dialog({
            peer,
            topMessage: 0,
            readInboxMaxId: 0,
            readOutboxMaxId: 0,
            unreadCount: 0,
            unreadMentionsCount: 0,
            unreadReactionsCount: 0,
            notifySettings: new GramJs.PeerNotifySettings({}),
        });
    }

    createMessage(peer: GramJs.TypePeer) {
        return ({
            fromId,
            repliesChannelId,
            replyingTo,
        }: CreateMessageParams) => {
            const pi = this.getPeerIndex(peer);
            const p = this.getPeer(peer);
            if (!p || pi === undefined) return;

            const message = new GramJs.Message({
                id: p.TEST_messages.length + 1,
                fromId,
                peerId: peer,
                date: Number(new Date()) / 1000 + pi * 60,
                message: 'lol @channel',
                entities: [new GramJs.MessageEntityMention({
                    offset: 4,
                    length: 8,
                })],
                replyTo: replyingTo,
                replies: new GramJs.MessageReplies({
                    comments: true,
                    replies: 0,
                    repliesPts: 0,
                    channelId: repliesChannelId ? BigInt(repliesChannelId) : undefined,
                }),
            });
            this.peers[pi].TEST_messages.push(message);
            return message;
        };
    }

    createChat({}) {
        const chat = new GramJs.Chat({
            id: BigInt(this.lastId++),
            title: 'Some chat',
            photo: new GramJs.ChatPhotoEmpty(),
            participantsCount: 1,
            date: 1000,
            version: 1,
        });

        const peerChat = new GramJs.PeerChat({
            chatId: chat.id,
        });

        this.dialogs.push(this.createDialog(peerChat));

        const testChat: Peer = { peer: chat, TEST_messages: [], TEST_sendMessage: this.createMessage(peerChat) };

        this.peers.push(testChat);

        return testChat;
    }

    createChannel({ title, username, isMegagroup }: {
        title: string;
        username: string;
        isMegagroup?: boolean;
    }) {
        const channel = new GramJs.Channel({
            username,
            id: BigInt(this.lastId++),
            megagroup: isMegagroup ? true : undefined,
            title,
            photo: new GramJs.ChatPhotoEmpty(),
            participantsCount: 1,
            date: 1000,
            creator: true,
        });

        const peerChannel = new GramJs.PeerChannel({
            channelId: channel.id,
        });

        this.dialogs.push(this.createDialog(peerChannel));

        const testChat: Peer = { peer: channel, TEST_messages: [], TEST_sendMessage: this.createMessage(peerChannel) };

        this.peers.push(testChat);

        return testChat;
    }

    createUser({
        firstName,
        lastName,
    }: {
        firstName: string;
        lastName: string;
    }): Peer {
        const user = new GramJs.User({
            // self: true,
            verified: true,
            id: BigInt(this.lastId++),
            // accessHash?: long;
            firstName,
            lastName,
            username: 'man',
            // phone?: string;
            // photo?: Api.TypeUserProfilePhoto;
            // status?: Api.TypeUserStatus;
            // botInfoVersion?: int;
            // restrictionReason?: Api.//TypeRestrictionReason[];
            // botInlinePlaceholder?: string;
            // langCode?: string;
        });

        const peerUser = new GramJs.PeerUser({
            userId: user.id,
        });

        this.dialogs.push(this.createDialog(peerUser));

        const testChat: Peer = { peer: user, TEST_messages: [], TEST_sendMessage: this.createMessage(peerUser) };

        this.peers.push(testChat);

        return testChat;
    }

    async invoke(request: Request) {
    // await new Promise(resolve => setTimeout(resolve, 1000))
        if (request instanceof GramJs.messages.GetDiscussionMessage) {
            return new GramJs.messages.DiscussionMessage({
                messages: [
                    this.peers[3].TEST_messages[0],
                ],
                maxId: 2,
                unreadCount: 1,
                chats: [],
                users: [],
            });
        }
        if (request instanceof GramJs.messages.GetHistory) {
            const peer = this.getPeer(request.peer);
            if (!peer) return;

            return new GramJs.messages.Messages({
                messages: peer.TEST_messages,
                chats: [],
                users: [],
            });
        }
        if (request instanceof GramJs.messages.GetReplies) {
            const peer = this.peers[3];
            if (!peer) return;

            return new GramJs.messages.ChannelMessages({
                messages: peer.TEST_messages,
                pts: 0,
                count: peer.TEST_messages.length,
                chats: [],
                users: [],
            });
        }
        if (request instanceof GramJs.messages.GetDialogFilters) {
            return [new GramJs.DialogFilter({
                contacts: true,
                nonContacts: true,
                groups: true,
                broadcasts: true,
                bots: true,
                // excludeMuted?: true;
                // excludeRead?: true;
                // excludeArchived?: true;
                id: 1,
                title: 'Dialog Filter',
                // emoticon?: string;
                pinnedPeers: [],
                includePeers: [],
                excludePeers: [],
            })];
        }
        if (request instanceof GramJs.messages.GetPinnedDialogs) {
            return new GramJs.messages.PeerDialogs({
                dialogs: [],
                chats: [],
                messages: [],
                users: [],
                state: new GramJs.updates.State({
                    pts: 0,
                    qts: 0,
                    date: 0,
                    seq: 0,
                    unreadCount: 0,
                }),
            });
        }
        if (request instanceof GramJs.messages.GetDialogs) {
            if (request.folderId || !(request.offsetPeer instanceof GramJs.InputPeerEmpty)) {
                return new GramJs.messages.Dialogs({
                    dialogs: [],
                    users: [],
                    chats: [],
                    messages: [],
                });
            }

            return new GramJs.messages.Dialogs({
                dialogs: this.dialogs,
                messages: this.getAllMessages(),
                chats: this.getChats(),
                users: this.getUsers(),
            });
        }
    // console.log(request.className, request);
    }

    private getPeerIndex(peer: GramJs.TypeInputPeer) {
        const id = 'channelId' in peer ? peer.channelId : (
            'userId' in peer ? peer.userId : (
                'chatId' in peer ? peer.chatId : undefined
            )
        );

        if (!id) return undefined;

        return this.peers.findIndex((l) => l.peer.id.toString() === id.toString());
    }

    private getPeer(peer: GramJs.TypeInputPeer) {
        const index = this.getPeerIndex(peer);
        if (index === undefined) return undefined;

        return this.peers[index];
    }

    private getAllMessages() {
        return this.peers.reduce((acc: GramJs.Message[], el) => {
            acc.push(...el.TEST_messages);
            return acc;
        }, []);
    }

    private getChats() {
        return this.peers.filter((l) => !(l.peer instanceof GramJs.User)).map((l) => l.peer);
    }

    private getUsers() {
        return this.peers.filter((l) => l.peer instanceof GramJs.User).map((l) => l.peer);
    }
}

export default TelegramClient;
