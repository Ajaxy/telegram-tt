import BigInt from 'big-integer';
import { UpdateConnectionState } from '../network';
import Api from '../tl/api';

type Peer = {
    peer: Api.Chat | Api.Channel | Api.User;
    inputPeer: Api.TypePeer;
    TEST_messages: Api.Message[];
    TEST_sendMessage: (data: CreateMessageParams) => Api.Message | undefined;
};

type CreateMessageParams = {
    fromId?: any;
    repliesChannelId?: any;
    replyingTo?: Api.MessageReplyHeader;
};

class TelegramClient {
    addEventHandler(callback: any, event: any) {
        callback(event.build(new UpdateConnectionState(UpdateConnectionState.connected)));
    }

    private lastId = 0;

    private peers: Peer[] = [];

    private dialogs: Api.Dialog[] = [];

    start() {
    }

    constructor() {
        const user = this.createUser({
            firstName: 'Test',
            lastName: 'Account',
        });
        user.TEST_sendMessage({});

        const chat = this.createChat();
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
            fromId: new Api.PeerUser({
                userId: user.peer.id,
            }),
            replyingTo: new Api.MessageReplyHeader({
                replyToMsgId: id,
                replyToPeerId: new Api.PeerChannel({
                    channelId: channel.peer.id,
                }),
                replyToTopId: message!.id,
            }),
        });
    }

    createDialog(peer: Api.TypePeer) {
        return new Api.Dialog({
            peer,
            topMessage: 0,
            readInboxMaxId: 0,
            readOutboxMaxId: 0,
            unreadCount: 0,
            unreadMentionsCount: 0,
            unreadReactionsCount: 0,
            notifySettings: new Api.PeerNotifySettings({}),
        });
    }

    createMessage(peer: Api.TypePeer) {
        return ({
            fromId,
            repliesChannelId,
            replyingTo,
        }: CreateMessageParams) => {
            const pi = this.getPeerIndex(peer);
            const p = this.getPeer(peer);
            if (!p || pi === undefined) return undefined;

            const message = new Api.Message({
                id: p.TEST_messages.length + 1,
                fromId,
                peerId: peer,
                date: Number(new Date()) / 1000 + pi * 60,
                message: 'lol @channel',
                entities: [new Api.MessageEntityMention({
                    offset: 4,
                    length: 8,
                })],
                replyTo: replyingTo,
                replies: new Api.MessageReplies({
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

    createChat() {
        const chat = new Api.Chat({
            id: BigInt(this.lastId++),
            title: 'Some chat',
            photo: new Api.ChatPhotoEmpty(),
            participantsCount: 1,
            date: 1000,
            version: 1,
        });

        const peerChat = new Api.PeerChat({
            chatId: chat.id,
        });

        this.dialogs.push(this.createDialog(peerChat));

        const testChat: Peer = {
            peer: chat, inputPeer: peerChat, TEST_messages: [], TEST_sendMessage: this.createMessage(peerChat),
        };

        this.peers.push(testChat);

        return testChat;
    }

    createChannel({ title, username, isMegagroup }: {
        title: string;
        username: string;
        isMegagroup?: boolean;
    }) {
        const channel = new Api.Channel({
            username,
            id: BigInt(this.lastId++),
            megagroup: isMegagroup ? true : undefined,
            title,
            photo: new Api.ChatPhotoEmpty(),
            participantsCount: 1,
            date: 1000,
            creator: true,
        });

        const peerChannel = new Api.PeerChannel({
            channelId: channel.id,
        });

        this.dialogs.push(this.createDialog(peerChannel));

        const testChat: Peer = {
            peer: channel, inputPeer: peerChannel, TEST_messages: [], TEST_sendMessage: this.createMessage(peerChannel),
        };

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
        const user = new Api.User({
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

        const peerUser = new Api.PeerUser({
            userId: user.id,
        });

        this.dialogs.push(this.createDialog(peerUser));

        const testChat: Peer = {
            peer: user, inputPeer: peerUser, TEST_messages: [], TEST_sendMessage: this.createMessage(peerUser),
        };

        this.peers.push(testChat);

        return testChat;
    }

    invoke(request: any) {
    // await new Promise(resolve => setTimeout(resolve, 1000))
        if (request instanceof Api.messages.GetDiscussionMessage) {
            return new Api.messages.DiscussionMessage({
                messages: [
                    this.peers[3].TEST_messages[0],
                ],
                maxId: 2,
                unreadCount: 1,
                chats: [],
                users: [],
            });
        }
        if (request instanceof Api.messages.GetHistory) {
            const peer = this.getPeer(request.peer);
            if (!peer) return undefined;

            return new Api.messages.Messages({
                messages: peer.TEST_messages,
                chats: [],
                users: [],
            });
        }
        if (request instanceof Api.messages.GetReplies) {
            const peer = this.peers[3];
            if (!peer) return undefined;

            return new Api.messages.ChannelMessages({
                messages: peer.TEST_messages,
                topics: [],
                pts: 0,
                count: peer.TEST_messages.length,
                chats: [],
                users: [],
            });
        }
        if (request instanceof Api.messages.GetDialogFilters) {
            return [new Api.DialogFilter({
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
        if (request instanceof Api.contacts.GetTopPeers) {
            return new Api.contacts.TopPeers({
                categories: [new Api.TopPeerCategoryPeers({
                    category: new Api.TopPeerCategoryCorrespondents(),
                    count: 1,
                    peers: [
                        new Api.TopPeer({
                            peer: this.peers[0].inputPeer,
                            rating: 100,
                        }),
                    ],
                })],
                chats: [],
                users: [
                    this.getUsers()[0],
                ],
            });
        }
        if (request instanceof Api.messages.GetPinnedDialogs) {
            return new Api.messages.PeerDialogs({
                dialogs: [],
                chats: [],
                messages: [],
                users: [],
                state: new Api.updates.State({
                    pts: 0,
                    qts: 0,
                    date: 0,
                    seq: 0,
                    unreadCount: 0,
                }),
            });
        }
        if (request instanceof Api.messages.GetDialogs) {
            if (request.folderId || !(request.offsetPeer instanceof Api.InputPeerEmpty)) {
                return new Api.messages.Dialogs({
                    dialogs: [],
                    users: [],
                    chats: [],
                    messages: [],
                });
            }

            return new Api.messages.Dialogs({
                dialogs: this.dialogs,
                messages: this.getAllMessages(),
                chats: this.getChats(),
                users: this.getUsers(),
            });
        }
        return undefined;
    // console.log(request.className, request);
    }

    private getPeerIndex(peer: Api.TypeInputPeer) {
        const id = 'channelId' in peer ? peer.channelId : (
            'userId' in peer ? peer.userId : (
                'chatId' in peer ? peer.chatId : undefined
            )
        );

        if (!id) return undefined;

        return this.peers.findIndex((l) => l.peer.id.toString() === id.toString());
    }

    private getPeer(peer: Api.TypeInputPeer) {
        const index = this.getPeerIndex(peer);
        if (index === undefined) return undefined;

        return this.peers[index];
    }

    private getAllMessages() {
        return this.peers.reduce((acc: Api.Message[], el) => {
            acc.push(...el.TEST_messages);
            return acc;
        }, []);
    }

    private getChats() {
        return this.peers.filter((l) => !(l.peer instanceof Api.User)).map((l) => l.peer);
    }

    private getUsers() {
        return this.peers.filter((l) => l.peer instanceof Api.User).map((l) => l.peer);
    }
}

export default TelegramClient;
