import type { DownloadFileWithDcParams } from './downloadFile';
import type { MockTypes } from './mockUtils/MockTypes';
import type { SizeType } from './TelegramClient';

import { GENERAL_TOPIC_ID } from '../../../config';
import { toJSNumber } from '../../../util/numbers';
import { Logger } from '../extensions';
import { UpdateConnectionState } from '../network';
import Api from '../tl/api';
import createMockedAvailableReaction from './mockUtils/createMockedAvailableReaction';
import createMockedChannel from './mockUtils/createMockedChannel';
import createMockedChat from './mockUtils/createMockedChat';
import createMockedDialog from './mockUtils/createMockedDialog';
import createMockedDialogFilter from './mockUtils/createMockedDialogFilter';
import createMockedForumTopic from './mockUtils/createMockedForumTopic';
import createMockedJSON from './mockUtils/createMockedJSON';
import createMockedMessage from './mockUtils/createMockedMessage';
import createMockedTypePeer from './mockUtils/createMockedTypePeer';
import createMockedUser from './mockUtils/createMockedUser';
import getDocumentIdFromLocation from './mockUtils/getDocumentIdFromLocation';
import getIdFromInputPeer from './mockUtils/getIdFromInputPeer';
import { downloadFile } from './downloadFile';

import MockSender from './MockSender';

const sizeTypes: SizeType[] = ['u', 'v', 'w', 'y', 'd', 'x', 'c', 'm', 'b', 'a', 's', 'f'];

class TelegramClient {
  private invokeMiddleware?: <A, R>(mockClient: TelegramClient, request: Api.Request<A, R>)
  => Promise<R | undefined | 'pass'>;

  public mockData: MockTypes = {
    users: [],
    chats: [],
    channels: [],
    dialogFilters: [],
    dialogs: {
      active: [],
      archived: [],
    },
    messages: {},
    availableReactions: [],
    documents: [],
    topPeers: [],
  };

  private _log: Logger;

  constructor() {
    this._log = new Logger();
  }

  private callbacks: {
    callback: any;
    eventBuilder: any;
  }[] = [];

  addEventHandler(callback: any, eventBuilder: any) {
    this.callbacks.push({
      callback,
      eventBuilder,
    });
  }

  async loadScenario(scenario = 'default'): Promise<void> {
    try {
      const invokeMiddleware = await import(`./__invokeMiddlewares__/${scenario}`);

      this.invokeMiddleware = invokeMiddleware.default;
    } catch (e) {
      // Ignore and use the default logic
    }
    return import(`./__mocks__/${scenario}.json`).then(async (mockData) => {
      this.mockData = mockData as MockTypes;
      await Promise.all(this.mockData.documents.map(async (l, i) => {
        const response = await import(`./__data__/${l.url}`).then((module) => fetch(module.default));
        const bytes = await response.arrayBuffer();
        this.mockData.documents[i].size = BigInt(bytes.byteLength);
        this.mockData.documents[i].bytes = Buffer.from(new Uint8Array(bytes));
      }));

      this.callbacks.forEach(({ eventBuilder, callback }) => (callback(
        eventBuilder.build(new UpdateConnectionState(UpdateConnectionState.connected)),
      )));
    }).catch(() => this.loadScenario());
  }

  fireUpdate(update: Api.TypeUpdate) {
    this.callbacks.forEach(({ eventBuilder, callback }) => (callback(eventBuilder.build(update))));
  }

  getUser(id: string) {
    return createMockedUser(id, this.mockData);
  }

  getDialogs(type: 'active' | 'archived' = 'active') {
    return this.mockData.dialogs[type].map((dialog) => createMockedDialog(dialog.id, this.mockData));
  }

  start({
    mockScenario,
  }: {
    mockScenario: string;
  }) {
    return this.loadScenario(mockScenario);
  }

  async invoke<A, R>(request: Api.Request<A, R>) {
    if (this.invokeMiddleware) {
      const a = await this.invokeMiddleware(this, request);
      if (a !== 'pass') {
        return a;
      }
    }

    if (this.mockData.appConfig && request instanceof Api.help.GetAppConfig) {
      return createMockedJSON(this.mockData.appConfig);
    }

    if (request instanceof Api.messages.GetDiscussionMessage) {
      const peerId = getIdFromInputPeer(request.peer);
      if (!peerId) return undefined;

      return new Api.messages.DiscussionMessage({
        messages: this.getMessagesFrom(peerId).filter((l) => l.id === request.msgId),
        unreadCount: 0,
        chats: [],
        users: [],
      });
    }

    if (request instanceof Api.messages.GetReplies) {
      const peerId = getIdFromInputPeer(request.peer);
      if (!peerId) return undefined;

      const messages = this.mockData.messages[peerId].filter((message) => message.replyToTopId === request.msgId);
      return new Api.messages.Messages({
        messages: messages.map((message) => createMockedMessage(peerId, message.id, this.mockData)),
        chats: [],
        users: [],
        topics: [],
      });
    }

    if (request instanceof Api.contacts.GetTopPeers) {
      return new Api.contacts.TopPeers({
        categories: [new Api.TopPeerCategoryPeers({
          category: new Api.TopPeerCategoryCorrespondents(),
          count: this.mockData.topPeers.length,
          peers: this.mockData.topPeers.map((id) => {
            return new Api.TopPeer({
              peer: createMockedTypePeer(id, this.mockData),
              rating: 100,
            });
          }),
        })],
        chats: [],
        users: this.getUsers(),
      });
    }

    if (request instanceof Api.messages.GetForumTopics) {
      const peerId = getIdFromInputPeer(request.peer);
      if (!peerId) return undefined;

      const topics = this.getChannel(peerId)?.forumTopics;

      if (!topics) return undefined;

      const hasGeneralTopic = topics.some((l) => l.id === GENERAL_TOPIC_ID);
      const offsetTopicId = request.offsetTopic;
      const limit = request.limit;
      return new Api.messages.ForumTopics({
        topics: topics
          .sort((a, b) => b.id - a.id)
          .map((topic) => {
            return createMockedForumTopic(peerId, topic.id, this.mockData);
          }).filter((topic) => {
            if (offsetTopicId) {
              return topic.id < offsetTopicId;
            }
            return true;
          }).slice(0, limit),
        users: [],
        chats: [],
        messages: [],
        pts: 0,
        count: topics.length - (hasGeneralTopic ? 1 : 0),
      });
    }

    if (request instanceof Api.users.GetFullUser) {
      return new Api.users.UserFull({
        fullUser: new Api.UserFull({
          about: 'lol',
          settings: new Api.PeerSettings({}),
          notifySettings: new Api.PeerNotifySettings({}),
          id: 1n,
          commonChatsCount: 0,
        }),
        chats: [],
        users: [],
      });
    }

    if (request instanceof Api.messages.GetAvailableReactions) {
      return new Api.messages.AvailableReactions({
        reactions: this.mockData.availableReactions.map((reaction) => {
          return createMockedAvailableReaction(reaction, this.mockData);
        }),
        hash: 1,
      });
    }

    if (request instanceof Api.messages.GetHistory) {
      const peerId = getIdFromInputPeer(request.peer);
      if (!peerId) return undefined;

      return new Api.messages.Messages({
        messages: this.getMessagesFrom(peerId),
        chats: [],
        users: [],
        topics: [],
      });
    }

    if (request instanceof Api.upload.GetFile) {
      const fileId = getDocumentIdFromLocation(request.location);
      if (fileId === undefined) return undefined;

      return new Api.upload.File({
        type: new Api.storage.FileUnknown(),
        mtime: 0,
        bytes: Buffer.from(new Uint8Array(this.mockData.documents.find((i) => i.id === fileId)!.bytes)),
      });
    }

    if (request instanceof Api.messages.GetDialogFilters) {
      return [
        new Api.DialogFilterDefault(),
        ...this.mockData.dialogFilters
          .map((dialogFilter) => createMockedDialogFilter(dialogFilter.id, this.mockData)),
      ];
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
        dialogs: this.getDialogs(),
        messages: this.getAllMessages(),
        chats: this.getChatsAndChannels(),
        users: this.getUsers(),
      });
    }
    return undefined;
  }

  public getSender() {
    return new MockSender(this);
  }

  downloadFile(inputLocation: any, args: DownloadFileWithDcParams) {
    return downloadFile(this as any, inputLocation, args);
  }

  _downloadPhoto(photo: Api.MessageMediaPhoto | Api.TypePhoto | undefined, args: any) {
    if (photo instanceof Api.MessageMediaPhoto) {
      photo = photo.photo;
    }
    if (!(photo instanceof Api.Photo)) {
      return undefined;
    }
    const isVideoSize = args.sizeType === 'u' || args.sizeType === 'v';
    const size = this._pickFileSize(isVideoSize
      ? [...(photo.videoSizes as any), ...photo.sizes]
      : photo.sizes, args.sizeType);
    if (!size || (size instanceof Api.PhotoSizeEmpty)) {
      return undefined;
    }

    if (size instanceof Api.PhotoCachedSize || size instanceof Api.PhotoStrippedSize) {
      // TODO[mock] Implement
      // return this._downloadCachedPhotoSize(size);
      return undefined;
    }
    return this.downloadFile(
      new Api.InputPhotoFileLocation({
        id: photo.id,
        accessHash: photo.accessHash,
        fileReference: photo.fileReference,
        thumbSize: size.type,
      }),
      {
        dcId: photo.dcId,
        fileSize: size.size || Math.max(...(size.sizes || [])),
        progressCallback: args.progressCallback,
      },
    );
  }

  downloadMedia(messageOrMedia: any, args: any) {
    let media;
    if (messageOrMedia instanceof Api.Message) {
      media = messageOrMedia.media;
    } else {
      media = messageOrMedia;
    }
    if (typeof media === 'string') {
      throw new Error('not implemented');
    }

    if (media instanceof Api.MessageMediaWebPage) {
      if (media.webpage instanceof Api.WebPage) {
        media = media.webpage.document || media.webpage.photo;
      }
    }
    if (media instanceof Api.MessageMediaPhoto || media instanceof Api.Photo) {
      return this._downloadPhoto(media, args);
    } else if (media instanceof Api.MessageMediaDocument || media instanceof Api.Document) {
      return this._downloadDocument(media, args);
    } else if (media instanceof Api.MessageMediaContact) {
      return undefined;
    } else if (media instanceof Api.WebDocument || media instanceof Api.WebDocumentNoProxy) {
      return undefined;
    }
    return undefined;
  }

  _downloadDocument(doc: any, args: any) {
    if (doc instanceof Api.MessageMediaDocument) {
      doc = doc.document;
    }
    if (!(doc instanceof Api.Document)) {
      return undefined;
    }

    let size;
    if (args.sizeType) {
      size = doc.thumbs ? this._pickFileSize([...(doc.videoThumbs || []),
        ...doc.thumbs], args.sizeType) : undefined;
      if (!size && doc.mimeType.startsWith('video/')) {
        return undefined;
      }

      if (size && (size instanceof Api.PhotoCachedSize
        || size instanceof Api.PhotoStrippedSize)) {
        // TODO[mock] Implement
        // return this._downloadCachedPhotoSize(size);
        return undefined;
      }
    }

    return this.downloadFile(
      new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
        thumbSize: size ? size.type : '',
      }),
      {
        fileSize: size ? size.size : toJSNumber(doc.size),
        progressCallback: args.progressCallback,
        start: args.start,
        end: args.end,
        dcId: doc.dcId,
        workers: args.workers,
      },
    );
  }

  _pickFileSize(sizes: any, sizeType: any) {
    if (!sizeType || !sizes || !sizes.length) {
      return undefined;
    }
    const indexOfSize = sizeTypes.indexOf(sizeType);
    let size;
    for (let i = indexOfSize; i < sizeTypes.length; i++) {
      size = sizes.find((s: any) => s.type === sizeTypes[i]);
      if (size) {
        return size;
      }
    }
    return undefined;
  }

  public setPingCallback() {}

  public setShouldDebugExportedSenders() {}

  public isConnected() {
    return true;
  }

  public releaseExportedSender() {}

  private getMessagesFrom(chatId: string) {
    return this.mockData.messages[chatId].map((message) => createMockedMessage(chatId, message.id, this.mockData));
  }

  private getAllMessages() {
    return Object.entries(this.mockData.messages).flatMap(([chatId, messages]) => {
      return messages.map((message) => createMockedMessage(chatId, message.id, this.mockData));
    });
  }

  private getChatsAndChannels() {
    return [...this.getChannels(), ...this.getChats()];
  }

  private getChats() {
    return this.mockData.chats.map((chat) => createMockedChat(chat.id, this.mockData));
  }

  private getChannel(chatId: string) {
    return this.mockData.channels.find((channel) => channel.id === chatId);
  }

  private getChannels() {
    return this.mockData.channels.map((channel) => createMockedChannel(channel.id, this.mockData));
  }

  private getUsers() {
    return this.mockData.users.map((user) => createMockedUser(user.id, this.mockData));
  }
}

export default TelegramClient;
