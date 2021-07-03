import { Api as GramJs, connection } from '../../lib/gramjs';
import { ApiMessage, ApiUpdateConnectionStateType, OnApiUpdate } from '../types';

import { pick } from '../../util/iteratees';
import {
  buildApiMessage,
  buildApiMessageFromShort,
  buildApiMessageFromShortChat,
  buildMessageMediaContent,
  buildMessageTextContent,
  buildPoll,
  buildPollResults,
  buildApiMessageFromNotification,
  buildMessageDraft,
} from './apiBuilders/messages';
import {
  getApiChatIdFromMtpPeer,
  buildChatMember,
  buildChatMembers,
  buildChatTypingStatus,
  buildAvatarHash,
  buildApiChatFromPreview,
  buildApiChatFolder,
  getApiChatIdFromInputMtpPeer,
} from './apiBuilders/chats';
import { buildApiUser, buildApiUserStatus } from './apiBuilders/users';
import {
  buildMessageFromUpdate,
  isMessageWithMedia,
  buildChatPhotoForLocalDb,
} from './gramjsBuilders';
import localDb from './localDb';
import { omitVirtualClassFields } from './apiBuilders/helpers';
import { DEBUG } from '../../config';
import { addMessageToLocalDb, addPhotoToLocalDb, resolveMessageApiChatId } from './helpers';
import { buildPrivacyKey, buildPrivacyRules } from './apiBuilders/misc';
import { buildApiPhoto } from './apiBuilders/common';

type Update = (
  (GramJs.TypeUpdate | GramJs.TypeUpdates) & { _entities?: (GramJs.TypeUser | GramJs.TypeChat)[] }
) | typeof connection.UpdateConnectionState;

const DELETE_MISSING_CHANNEL_MESSAGE_DELAY = 1000;

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

const sentMessageIds = new Set();
let serverTimeOffset = 0;

export function updater(update: Update, originRequest?: GramJs.AnyRequest) {
  if (update instanceof connection.UpdateServerTimeOffset) {
    serverTimeOffset = update.timeOffset;
  } else if (update instanceof connection.UpdateConnectionState) {
    let connectionState: ApiUpdateConnectionStateType;

    switch (update.state) {
      case connection.UpdateConnectionState.disconnected:
        connectionState = 'connectionStateConnecting';
        break;
      case connection.UpdateConnectionState.broken:
        connectionState = 'connectionStateBroken';
        break;
      case connection.UpdateConnectionState.connected:
      default:
        connectionState = 'connectionStateReady';
        break;
    }

    onUpdate({
      '@type': 'updateConnectionState',
      connectionState,
    });

    // Messages
  } else if (
    update instanceof GramJs.UpdateNewMessage
    || update instanceof GramJs.UpdateNewScheduledMessage
    || update instanceof GramJs.UpdateNewChannelMessage
    || update instanceof GramJs.UpdateShortChatMessage
    || update instanceof GramJs.UpdateShortMessage
    || update instanceof GramJs.UpdateServiceNotification
  ) {
    let message: ApiMessage | undefined;

    if (update instanceof GramJs.UpdateShortChatMessage) {
      message = buildApiMessageFromShortChat(update);
    } else if (update instanceof GramJs.UpdateShortMessage) {
      message = buildApiMessageFromShort(update);
    } else if (update instanceof GramJs.UpdateServiceNotification) {
      const currentDate = Date.now() / 1000 + serverTimeOffset;
      message = buildApiMessageFromNotification(update, currentDate);

      if (isMessageWithMedia(update)) {
        addMessageToLocalDb(buildMessageFromUpdate(message.id, message.chatId, update));
      }
    } else {
      // TODO Remove if proven not reproducing
      if (update.message instanceof GramJs.MessageEmpty) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('Unexpected update:', update.className, update);
        }

        return;
      }

      if (update.message instanceof GramJs.Message && isMessageWithMedia(update.message)) {
        addMessageToLocalDb(update.message);
      }

      message = buildApiMessage(update.message)!;
    }

    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities && entities.length) {
      entities
        .filter((e) => e instanceof GramJs.User)
        .map(buildApiUser)
        .forEach((user) => {
          if (!user) {
            return;
          }

          onUpdate({
            '@type': 'updateUser',
            id: user.id,
            user,
          });
        });
      entities
        .filter((e) => e instanceof GramJs.Chat || e instanceof GramJs.Channel)
        .map((e) => buildApiChatFromPreview(e))
        .forEach((chat) => {
          if (!chat) {
            return;
          }

          onUpdate({
            '@type': 'updateChat',
            id: chat.id,
            chat,
          });
        });
    }

    if (update instanceof GramJs.UpdateNewScheduledMessage) {
      onUpdate({
        '@type': sentMessageIds.has(message.id) ? 'updateScheduledMessage' : 'newScheduledMessage',
        id: message.id,
        chatId: message.chatId,
        message,
      });
    } else {
      onUpdate({
        '@type': sentMessageIds.has(message.id) ? 'updateMessage' : 'newMessage',
        id: message.id,
        chatId: message.chatId,
        message,
      });
    }

    // Some updates to a Chat/Channel don't have a dedicated update class.
    // We can get info on some updates from Service Messages.
    if (update.message instanceof GramJs.MessageService) {
      const { action } = update.message;

      if (action instanceof GramJs.MessageActionChatEditTitle) {
        onUpdate({
          '@type': 'updateChat',
          id: message.chatId,
          chat: {
            title: action.title,
          },
        });
      } else if (action instanceof GramJs.MessageActionChatEditPhoto) {
        const photo = buildChatPhotoForLocalDb(action.photo);
        const avatarHash = buildAvatarHash(photo);

        const localDbChatId = Math.abs(resolveMessageApiChatId(update.message)!);
        if (localDb.chats[localDbChatId]) {
          localDb.chats[localDbChatId].photo = photo;
        }
        addPhotoToLocalDb(action.photo);

        if (avatarHash) {
          onUpdate({
            '@type': 'updateChat',
            id: message.chatId,
            chat: {
              avatarHash,
            },
            ...(action.photo instanceof GramJs.Photo && { newProfilePhoto: buildApiPhoto(action.photo) }),
          });
        }
      } else if (action instanceof GramJs.MessageActionChatDeletePhoto) {
        const localDbChatId = Math.abs(resolveMessageApiChatId(update.message)!);
        if (localDb.chats[localDbChatId]) {
          localDb.chats[localDbChatId].photo = new GramJs.ChatPhotoEmpty();
        }

        onUpdate({
          '@type': 'updateChat',
          id: message.chatId,
          chat: { avatarHash: undefined },
        });
      } else if (action instanceof GramJs.MessageActionChatDeleteUser) {
        // eslint-disable-next-line no-underscore-dangle
        if (update._entities && update._entities.some((e): e is GramJs.User => (
          e instanceof GramJs.User && !!e.self && e.id === action.userId
        ))) {
          onUpdate({
            '@type': 'updateChatLeave',
            id: message.chatId,
          });
        }
      } else if (action instanceof GramJs.MessageActionChatAddUser) {
        // eslint-disable-next-line no-underscore-dangle
        if (update._entities && update._entities.some((e): e is GramJs.User => (
          e instanceof GramJs.User && !!e.self && action.users.includes(e.id)
        ))) {
          onUpdate({
            '@type': 'updateChatJoin',
            id: message.chatId,
          });
        }
      }
    }
  } else if (
    update instanceof GramJs.UpdateEditMessage
    || update instanceof GramJs.UpdateEditChannelMessage
  ) {
    // TODO Remove if proven not reproducing
    if (update.message instanceof GramJs.MessageEmpty) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Unexpected update:', update.className, update);
      }

      return;
    }

    if (update.message instanceof GramJs.Message && isMessageWithMedia(update.message)) {
      addMessageToLocalDb(update.message);
    }

    const message = buildApiMessage(update.message)!;

    onUpdate({
      '@type': 'updateMessage',
      id: message.id,
      chatId: message.chatId,
      message,
    });
  } else if (update instanceof GramJs.UpdateDeleteMessages) {
    onUpdate({
      '@type': 'deleteMessages',
      ids: update.messages,
    });
  } else if (update instanceof GramJs.UpdateDeleteScheduledMessages) {
    onUpdate({
      '@type': 'deleteScheduledMessages',
      ids: update.messages,
      chatId: getApiChatIdFromInputMtpPeer(update.peer),
    });
  } else if (update instanceof GramJs.UpdateDeleteChannelMessages) {
    const chatId = getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel);
    const ids = update.messages;
    const existingIds = ids.filter((id) => localDb.messages[`${chatId}-${id}`]);
    const missingIds = ids.filter((id) => !localDb.messages[`${chatId}-${id}`]);
    const profilePhotoIds = ids.map((id) => {
      const message = localDb.messages[`${chatId}-${id}`];

      return message && message instanceof GramJs.MessageService && 'photo' in message.action
        ? String(message.action.photo.id)
        : undefined;
    }).filter<string>(Boolean as any);

    if (existingIds.length) {
      onUpdate({
        '@type': 'deleteMessages',
        ids: existingIds,
        chatId,
      });
    }

    if (profilePhotoIds.length) {
      onUpdate({
        '@type': 'deleteProfilePhotos',
        ids: profilePhotoIds,
        chatId,
      });
    }

    // For some reason delete message update sometimes comes before new message update
    if (missingIds.length) {
      setTimeout(() => {
        onUpdate({
          '@type': 'deleteMessages',
          ids: missingIds,
          chatId,
        });
      }, DELETE_MISSING_CHANNEL_MESSAGE_DELAY);
    }
  } else if ((
    originRequest instanceof GramJs.messages.SendMessage
    || originRequest instanceof GramJs.messages.SendMedia
    || originRequest instanceof GramJs.messages.SendMultiMedia
    || originRequest instanceof GramJs.messages.ForwardMessages
  ) && (
    update instanceof GramJs.UpdateMessageID
    || update instanceof GramJs.UpdateShortSentMessage
  )) {
    let randomId;
    if ('randomId' in update) {
      randomId = update.randomId;
    } else if ('randomId' in originRequest) {
      randomId = originRequest.randomId;
    }

    const localMessage = randomId && localDb.localMessages[randomId.toString()];
    if (!localMessage) {
      throw new Error('Local message not found');
    }

    let newContent: ApiMessage['content'] | undefined;
    if (update instanceof GramJs.UpdateShortSentMessage) {
      if (localMessage.content.text && update.entities) {
        newContent = {
          text: buildMessageTextContent(localMessage.content.text.text, update.entities),
        };
      }
      if (update.media) {
        newContent = {
          ...newContent,
          ...buildMessageMediaContent(update.media),
        };
      }

      const mtpMessage = buildMessageFromUpdate(update.id, localMessage.chatId, update);
      if (isMessageWithMedia(mtpMessage)) {
        addMessageToLocalDb(mtpMessage);
      }
    }

    sentMessageIds.add(update.id);

    // Edge case for "Send When Online"
    const isAlreadySent = 'date' in update && update.date * 1000 < Date.now() + serverTimeOffset * 1000;

    onUpdate({
      '@type': localMessage.isScheduled && !isAlreadySent
        ? 'updateScheduledMessageSendSucceeded'
        : 'updateMessageSendSucceeded',
      chatId: localMessage.chatId,
      localId: localMessage.id,
      message: {
        ...localMessage,
        ...(newContent && {
          content: {
            ...localMessage.content,
            ...newContent,
          },
        }),
        id: update.id,
        sendingState: undefined,
        ...('date' in update && { date: update.date }),
      },
    });
  } else if (update instanceof GramJs.UpdateReadMessagesContents) {
    onUpdate({
      '@type': 'updateCommonBoxMessages',
      ids: update.messages,
      messageUpdate: {
        hasUnreadMention: false,
        isMediaUnread: false,
      },
    });
  } else if (update instanceof GramJs.UpdateChannelReadMessagesContents) {
    onUpdate({
      '@type': 'updateChannelMessages',
      channelId: update.channelId,
      ids: update.messages,
      messageUpdate: {
        hasUnreadMention: false,
        isMediaUnread: false,
      },
    });
  } else if (update instanceof GramJs.UpdateMessagePoll) {
    const { pollId, poll, results } = update;
    if (poll) {
      const apiPoll = buildPoll(poll, results);

      onUpdate({
        '@type': 'updateMessagePoll',
        pollId: pollId.toString(),
        pollUpdate: apiPoll,
      });
    } else {
      const pollResults = buildPollResults(results);
      onUpdate({
        '@type': 'updateMessagePoll',
        pollId: pollId.toString(),
        pollUpdate: { results: pollResults },
      });
    }
  } else if (update instanceof GramJs.UpdateMessagePollVote) {
    onUpdate({
      '@type': 'updateMessagePollVote',
      pollId: update.pollId.toString(),
      userId: update.userId,
      options: update.options.map((option) => String.fromCharCode(...option)),
    });
  } else if (update instanceof GramJs.UpdateChannelMessageViews) {
    onUpdate({
      '@type': 'updateMessage',
      chatId: getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel),
      id: update.id,
      message: { views: update.views },
    });

    // Chats
  } else if (update instanceof GramJs.UpdateReadHistoryInbox) {
    onUpdate({
      '@type': 'updateChatInbox',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        lastReadInboxMessageId: update.maxId,
        unreadCount: update.stillUnreadCount,
      },
    });
  } else if (update instanceof GramJs.UpdateReadHistoryOutbox) {
    onUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        lastReadOutboxMessageId: update.maxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelInbox) {
    onUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel),
      chat: {
        lastReadInboxMessageId: update.maxId,
        unreadCount: update.stillUnreadCount,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelOutbox) {
    onUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel),
      chat: {
        lastReadOutboxMessageId: update.maxId,
      },
    });
  } else if (
    update instanceof GramJs.UpdateDialogPinned
    && update.peer instanceof GramJs.DialogPeer
  ) {
    onUpdate({
      '@type': 'updateChatPinned',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      isPinned: update.pinned || false,
    });
  } else if (update instanceof GramJs.UpdatePinnedDialogs) {
    const ids = update.order
      ? update.order
        .filter((dp): dp is GramJs.DialogPeer => dp instanceof GramJs.DialogPeer)
        .map((dp) => getApiChatIdFromMtpPeer(dp.peer))
      : [];

    onUpdate({
      '@type': 'updatePinnedChatIds',
      ids,
      folderId: update.folderId || undefined,
    });
  } else if (update instanceof GramJs.UpdateFolderPeers) {
    update.folderPeers.forEach((folderPeer) => {
      const { folderId, peer } = folderPeer;

      onUpdate({
        '@type': 'updateChatListType',
        id: getApiChatIdFromMtpPeer(peer),
        folderId,
      });
    });
  } else if (update instanceof GramJs.UpdateDialogFilter) {
    const { id, filter } = update;
    const folder = filter ? buildApiChatFolder(filter) : undefined;

    onUpdate({
      '@type': 'updateChatFolder',
      id,
      folder,
    });
  } else if (update instanceof GramJs.UpdateDialogFilterOrder) {
    onUpdate({
      '@type': 'updateChatFoldersOrder',
      orderedIds: update.order,
    });
  } else if (update instanceof GramJs.UpdateChatParticipants) {
    const replacedMembers = buildChatMembers(update.participants);

    onUpdate({
      '@type': 'updateChatMembers',
      id: getApiChatIdFromMtpPeer({ chatId: update.participants.chatId } as GramJs.TypePeer),
      replacedMembers,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantAdd) {
    const addedMember = buildChatMember(
      pick(update, ['userId', 'inviterId', 'date']) as GramJs.ChatParticipant,
    );

    onUpdate({
      '@type': 'updateChatMembers',
      id: getApiChatIdFromMtpPeer({ chatId: update.chatId } as GramJs.PeerChat),
      addedMember,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantDelete) {
    const { userId: deletedMemberId } = update;

    onUpdate({
      '@type': 'updateChatMembers',
      id: getApiChatIdFromMtpPeer({ chatId: update.chatId } as GramJs.PeerChat),
      deletedMemberId,
    });
  } else if (
    update instanceof GramJs.UpdatePinnedMessages
    || update instanceof GramJs.UpdatePinnedChannelMessages
  ) {
    const peer = update instanceof GramJs.UpdatePinnedMessages
      ? update.peer
      : { channelId: update.channelId } as GramJs.PeerChannel;
    const chatId = getApiChatIdFromMtpPeer(peer);

    onUpdate({
      '@type': 'updatePinnedIds',
      chatId,
      messageIds: update.messages,
      isPinned: update.pinned,
    });
  } else if (
    update instanceof GramJs.UpdateNotifySettings
    && update.peer instanceof GramJs.NotifyPeer
  ) {
    const {
      silent, muteUntil, showPreviews, sound,
    } = update.notifySettings;

    const isMuted = silent
      || (typeof muteUntil === 'number' && Date.now() + serverTimeOffset * 1000 < muteUntil * 1000);

    onUpdate({
      '@type': 'updateNotifyExceptions',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      isMuted,
      ...(sound === '' && { isSilent: true }),
      ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
    });
  } else if (
    update instanceof GramJs.UpdateUserTyping
    || update instanceof GramJs.UpdateChatUserTyping
  ) {
    const id = update instanceof GramJs.UpdateUserTyping
      ? update.userId
      : getApiChatIdFromMtpPeer({ chatId: update.chatId } as GramJs.PeerChat);

    onUpdate({
      '@type': 'updateChatTypingStatus',
      id,
      typingStatus: buildChatTypingStatus(update, serverTimeOffset),
    });
  } else if (update instanceof GramJs.UpdateChannelUserTyping) {
    const id = getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel);

    onUpdate({
      '@type': 'updateChatTypingStatus',
      id,
      typingStatus: buildChatTypingStatus(update, serverTimeOffset),
    });
  } else if (update instanceof GramJs.UpdateChannel) {
    const { _entities } = update;
    if (!_entities) {
      return;
    }

    const channel = _entities.find((e): e is GramJs.Channel | GramJs.ChannelForbidden => (
      e instanceof GramJs.Channel || e instanceof GramJs.ChannelForbidden
    ));

    if (channel instanceof GramJs.Channel) {
      const chat = buildApiChatFromPreview(channel);
      if (chat) {
        onUpdate({
          '@type': 'updateChat',
          id: chat.id,
          chat,
        });

        onUpdate({
          '@type': chat.isNotJoined ? 'updateChatLeave' : 'updateChatJoin',
          id: getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel),
        });
      }
    } else if (channel instanceof GramJs.ChannelForbidden) {
      const chatId = getApiChatIdFromMtpPeer({ channelId: update.channelId } as GramJs.PeerChannel);

      onUpdate({
        '@type': 'updateChat',
        id: chatId,
        chat: {
          isRestricted: true,
        },
      });

      onUpdate({
        '@type': 'updateChatLeave',
        id: chatId,
      });
    } else if (_entities.length === 0) {
      // The link to the discussion group may have been changed.
      // No corresponding update available at this moment https://core.telegram.org/type/Updates
      onUpdate({
        '@type': 'resetMessages',
        id: getApiChatIdFromMtpPeer({ chatId: update.channelId } as GramJs.PeerChat),
      });
    }
  } else if (
    update instanceof GramJs.UpdateDialogUnreadMark
    && update.peer instanceof GramJs.DialogPeer
  ) {
    onUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      chat: {
        hasUnreadMark: update.unread,
      },
    });
  } else if (update instanceof GramJs.UpdateChatDefaultBannedRights) {
    onUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        defaultBannedRights: omitVirtualClassFields(update.defaultBannedRights),
      },
    });

    // Users
  } else if (update instanceof GramJs.UpdateUserStatus) {
    const { userId, status } = update;

    onUpdate({
      '@type': 'updateUserStatus',
      userId,
      status: buildApiUserStatus(status),
    });
  } else if (update instanceof GramJs.UpdateUserName) {
    const updatedUser = localDb.users[update.userId];
    const user = updatedUser && updatedUser.mutualContact && !updatedUser.self
      ? pick(update, ['username'])
      : pick(update, ['firstName', 'lastName', 'username']);

    onUpdate({
      '@type': 'updateUser',
      id: update.userId,
      user,
    });
  } else if (update instanceof GramJs.UpdateUserPhoto) {
    const { userId, photo } = update;
    const avatarHash = buildAvatarHash(photo);

    if (localDb.users[userId]) {
      localDb.users[userId].photo = photo;
    }

    onUpdate({
      '@type': 'updateUser',
      id: userId,
      user: { avatarHash },
    });
  } else if (update instanceof GramJs.UpdateUserPhone) {
    const { userId, phone } = update;

    onUpdate({
      '@type': 'updateUser',
      id: userId,
      user: { phoneNumber: phone },
    });
  } else if (update instanceof GramJs.UpdatePeerSettings) {
    const { _entities } = update;
    if (!_entities) {
      return;
    }

    if (_entities && _entities.length) {
      _entities
        .filter((e) => e instanceof GramJs.User && !e.contact)
        .forEach((user) => {
          onUpdate({
            '@type': 'deleteUser',
            id: user.id,
          });
        });

      _entities
        .filter((e) => e instanceof GramJs.User && e.contact)
        .map(buildApiUser)
        .forEach((user) => {
          if (!user) {
            return;
          }

          onUpdate({
            '@type': 'updateUser',
            id: user.id,
            user,
          });
        });
    }

    // Settings
  } else if (update instanceof GramJs.UpdateNotifySettings) {
    const {
      notifySettings: {
        showPreviews, silent, muteUntil,
      },
      peer: { className },
    } = update;

    const peerType = className === 'NotifyUsers'
      ? 'contact'
      : (className === 'NotifyChats'
        ? 'group'
        : (className === 'NotifyBroadcasts'
          ? 'broadcast'
          : undefined
        )
      );

    if (!peerType) {
      return;
    }

    onUpdate({
      '@type': 'updateNotifySettings',
      peerType,
      isSilent: Boolean(silent
        || (typeof muteUntil === 'number' && Date.now() + serverTimeOffset * 1000 < muteUntil * 1000)),
      shouldShowPreviews: Boolean(showPreviews),
    });
  } else if (update instanceof GramJs.UpdatePeerBlocked) {
    onUpdate({
      '@type': 'updatePeerBlocked',
      id: getApiChatIdFromMtpPeer(update.peerId),
      isBlocked: update.blocked,
    });
  } else if (update instanceof GramJs.UpdatePrivacy) {
    const key = buildPrivacyKey(update.key);
    if (key) {
      onUpdate({
        '@type': 'updatePrivacy',
        key,
        rules: buildPrivacyRules(update.rules),
      });
    }

    // Misc
  } else if (update instanceof GramJs.UpdateDraftMessage) {
    onUpdate({
      '@type': 'draftMessage',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      ...buildMessageDraft(update.draft),
    });
  } else if (update instanceof GramJs.UpdateContactsReset) {
    onUpdate({ '@type': 'updateResetContactList' });
  } else if (update instanceof GramJs.UpdateFavedStickers) {
    onUpdate({ '@type': 'updateFavoriteStickers' });
  } else if (DEBUG) {
    const params = typeof update === 'object' && 'className' in update ? update.className : update;
    // eslint-disable-next-line no-console
    console.warn('[GramJs/updater] Unexpected update:', params);
  }
}
