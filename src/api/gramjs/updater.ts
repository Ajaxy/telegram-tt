import { Api as GramJs, connection } from '../../lib/gramjs';

import type { GroupCallConnectionData } from '../../lib/secret-sauce';
import type {
  ApiMessage, ApiMessageExtendedMediaPreview, ApiStory, ApiStorySkipped,
  ApiUpdate, ApiUpdateConnectionStateType, OnApiUpdate,
} from '../types';

import { DEBUG, GENERAL_TOPIC_ID } from '../../config';
import { omit, pick } from '../../util/iteratees';
import { getServerTimeOffset, setServerTimeOffset } from '../../util/serverTime';
import { buildApiBotMenuButton } from './apiBuilders/bots';
import {
  buildApiGroupCall,
  buildApiGroupCallParticipant,
  buildPhoneCall,
  getGroupCallId,
} from './apiBuilders/calls';
import {
  buildApiChatFolder,
  buildApiChatFromPreview,
  buildApiChatSettings,
  buildAvatarHash,
  buildChatMember,
  buildChatMembers,
  buildChatTypingStatus,
} from './apiBuilders/chats';
import { buildApiPhoto, buildApiUsernames, buildPrivacyRules } from './apiBuilders/common';
import { omitVirtualClassFields } from './apiBuilders/helpers';
import {
  buildApiMessageExtendedMediaPreview,
  buildMessageMediaContent,
  buildPoll,
  buildPollResults,
} from './apiBuilders/messageContent';
import {
  buildApiMessage,
  buildApiMessageFromNotification,
  buildApiMessageFromShort,
  buildApiMessageFromShortChat,
  buildMessageDraft,
} from './apiBuilders/messages';
import {
  buildApiNotifyException,
  buildApiNotifyExceptionTopic,
  buildPrivacyKey,
} from './apiBuilders/misc';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './apiBuilders/peers';
import {
  buildApiReaction,
  buildMessageReactions,
} from './apiBuilders/reactions';
import { buildApiStealthMode, buildApiStory } from './apiBuilders/stories';
import { buildApiEmojiInteraction, buildStickerSet } from './apiBuilders/symbols';
import {
  buildApiUser,
  buildApiUserEmojiStatus,
  buildApiUserStatus,
} from './apiBuilders/users';
import {
  buildChatPhotoForLocalDb,
  buildMessageFromUpdate,
  isMessageWithMedia,
} from './gramjsBuilders';
import {
  addEntitiesToLocalDb,
  addMessageToLocalDb,
  addPhotoToLocalDb,
  addStoryToLocalDb,
  isChatFolder,
  log,
  resolveMessageApiChatId,
  serializeBytes,
  swapLocalInvoiceMedia,
} from './helpers';
import localDb from './localDb';
import { scheduleMutedChatUpdate, scheduleMutedTopicUpdate } from './scheduleUnmute';

export type Update = (
  (GramJs.TypeUpdate | GramJs.TypeUpdates) & { _entities?: (GramJs.TypeUser | GramJs.TypeChat)[] }
) | typeof connection.UpdateConnectionState;

const DELETE_MISSING_CHANNEL_MESSAGE_DELAY = 1000;

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

const sentMessageIds = new Set();

export function dispatchUserAndChatUpdates(entities: (GramJs.TypeUser | GramJs.TypeChat)[]) {
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
    .filter((e) => (
      e instanceof GramJs.Chat || e instanceof GramJs.ChatForbidden
      || e instanceof GramJs.Channel || e instanceof GramJs.ChannelForbidden
    ))
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

export function sendUpdate(update: ApiUpdate) {
  onUpdate(update);
}

export function updater(update: Update) {
  if (update instanceof connection.UpdateServerTimeOffset) {
    setServerTimeOffset(update.timeOffset);

    onUpdate({
      '@type': 'updateServerTimeOffset',
      serverTimeOffset: update.timeOffset,
    });
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
  ) {
    let message: ApiMessage | undefined;
    let shouldForceReply: boolean | undefined;

    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    if (update instanceof GramJs.UpdateShortChatMessage) {
      message = buildApiMessageFromShortChat(update);
    } else if (update instanceof GramJs.UpdateShortMessage) {
      message = buildApiMessageFromShort(update);
    } else {
      // TODO Remove if proven not reproducing
      if (update.message instanceof GramJs.MessageEmpty) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('Unexpected update:', update.className, update);
        }

        return;
      }

      if ((update.message instanceof GramJs.Message && isMessageWithMedia(update.message))
      || (update.message instanceof GramJs.MessageService
          && update.message.action instanceof GramJs.MessageActionSuggestProfilePhoto)
      ) {
        addMessageToLocalDb(update.message);
      }

      message = buildApiMessage(update.message)!;
      shouldForceReply = 'replyMarkup' in update.message
        && update.message?.replyMarkup instanceof GramJs.ReplyKeyboardForceReply
        && (!update.message.replyMarkup.selective || message.isMentioned);
    }

    if (update instanceof GramJs.UpdateNewScheduledMessage) {
      onUpdate({
        '@type': sentMessageIds.has(message.id) ? 'updateScheduledMessage' : 'newScheduledMessage',
        id: message.id,
        chatId: message.chatId,
        message,
      });
    } else {
      // We don't have preview for action or 'via bot' messages, so `newMessage` update here is required
      const hasLocalCopy = sentMessageIds.has(message.id) && !message.viaBotId && !message.content.action;
      onUpdate({
        '@type': hasLocalCopy ? 'updateMessage' : 'newMessage',
        id: message.id,
        chatId: message.chatId,
        message,
        shouldForceReply,
      });
    }

    // Some updates to a Chat/Channel don't have a dedicated update class.
    // We can get info on some updates from Service Messages.
    if (update.message instanceof GramJs.MessageService) {
      const { action } = update.message;

      if (action instanceof GramJs.MessageActionPaymentSent) {
        onUpdate({
          '@type': 'updatePaymentStateCompleted',
          slug: action.invoiceSlug,
        });
      } else if (action instanceof GramJs.MessageActionChatEditTitle) {
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

        const localDbChatId = resolveMessageApiChatId(update.message)!;
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
        const localDbChatId = resolveMessageApiChatId(update.message)!;
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
          e instanceof GramJs.User && Boolean(e.self) && e.id === action.userId
        ))) {
          onUpdate({
            '@type': 'updateChat',
            id: message.chatId,
            chat: {
              isForbidden: true,
              isNotJoined: true,
            },
          });
        }
      } else if (action instanceof GramJs.MessageActionChatAddUser) {
        // eslint-disable-next-line no-underscore-dangle
        if (update._entities && update._entities.some((e): e is GramJs.User => (
          e instanceof GramJs.User && Boolean(e.self) && action.users.includes(e.id)
        ))) {
          onUpdate({
            '@type': 'updateChatJoin',
            id: message.chatId,
          });
        }
      } else if (action instanceof GramJs.MessageActionGroupCall) {
        if (!action.duration && action.call) {
          onUpdate({
            '@type': 'updateGroupCallChatId',
            chatId: message.chatId,
            call: {
              id: action.call.id.toString(),
              accessHash: action.call.accessHash.toString(),
            },
          });
        }
      } else if (action instanceof GramJs.MessageActionTopicEdit) {
        const replyTo = update.message.replyTo instanceof GramJs.MessageReplyHeader
          ? update.message.replyTo
          : undefined;
        const {
          replyToMsgId, replyToTopId, forumTopic: isTopicReply,
        } = replyTo || {};
        const topicId = !isTopicReply ? GENERAL_TOPIC_ID : replyToTopId || replyToMsgId || GENERAL_TOPIC_ID;

        onUpdate({
          '@type': 'updateTopic',
          chatId: getApiChatIdFromMtpPeer(update.message.peerId!),
          topicId,
        });
      } else if (action instanceof GramJs.MessageActionTopicCreate) {
        onUpdate({
          '@type': 'updateTopics',
          chatId: getApiChatIdFromMtpPeer(update.message.peerId!),
        });
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

    // Workaround for a weird server behavior when own message is marked as incoming
    const message = omit(buildApiMessage(update.message)!, ['isOutgoing']);

    onUpdate({
      '@type': 'updateMessage',
      id: message.id,
      chatId: message.chatId,
      message,
    });
  } else if (update instanceof GramJs.UpdateMessageReactions) {
    onUpdate({
      '@type': 'updateMessageReactions',
      id: update.msgId,
      chatId: getApiChatIdFromMtpPeer(update.peer),
      reactions: buildMessageReactions(update.reactions),
    });
  } else if (update instanceof GramJs.UpdateMessageExtendedMedia) {
    let media: ApiMessage['content'] | undefined;
    if (update.extendedMedia instanceof GramJs.MessageExtendedMedia) {
      media = buildMessageMediaContent(update.extendedMedia.media);
    }

    let preview: ApiMessageExtendedMediaPreview | undefined;
    if (update.extendedMedia instanceof GramJs.MessageExtendedMediaPreview) {
      preview = buildApiMessageExtendedMediaPreview(update.extendedMedia);
    }

    if (!media && !preview) return;

    const chatId = getApiChatIdFromMtpPeer(update.peer);

    swapLocalInvoiceMedia(chatId, update.msgId, update.extendedMedia);

    onUpdate({
      '@type': 'updateMessageExtendedMedia',
      id: update.msgId,
      chatId,
      media,
      preview,
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
      chatId: getApiChatIdFromMtpPeer(update.peer),
    });
  } else if (update instanceof GramJs.UpdateDeleteChannelMessages) {
    const chatId = buildApiPeerId(update.channelId, 'channel');
    const ids = update.messages;
    const existingIds = ids.filter((id) => localDb.messages[`${chatId}-${id}`]);
    const missingIds = ids.filter((id) => !localDb.messages[`${chatId}-${id}`]);
    const profilePhotoIds = ids.map((id) => {
      const message = localDb.messages[`${chatId}-${id}`];

      return message && message instanceof GramJs.MessageService && 'photo' in message.action
        ? String(message.action.photo.id)
        : undefined;
    }).filter(Boolean);

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
  } else if (update instanceof GramJs.UpdateServiceNotification) {
    if (update.popup) {
      onUpdate({
        '@type': 'error',
        error: {
          message: update.message,
        },
      });
    } else {
      const currentDate = Date.now() / 1000 + getServerTimeOffset();
      const message = buildApiMessageFromNotification(update, currentDate);

      if (isMessageWithMedia(update)) {
        addMessageToLocalDb(buildMessageFromUpdate(message.id, message.chatId, update));
      }

      onUpdate({
        '@type': 'updateServiceNotification',
        message,
      });
    }
  } else if (update instanceof GramJs.UpdateMessageID || update instanceof GramJs.UpdateShortSentMessage) {
    sentMessageIds.add(update.id);
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
      channelId: buildApiPeerId(update.channelId, 'channel'),
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
        pollId: String(pollId),
        pollUpdate: apiPoll,
      });
    } else {
      const pollResults = buildPollResults(results);
      onUpdate({
        '@type': 'updateMessagePoll',
        pollId: String(pollId),
        pollUpdate: { results: pollResults },
      });
    }
  } else if (update instanceof GramJs.UpdateMessagePollVote) {
    onUpdate({
      '@type': 'updateMessagePollVote',
      pollId: String(update.pollId),
      peerId: getApiChatIdFromMtpPeer(update.peer),
      options: update.options.map(serializeBytes),
    });
  } else if (update instanceof GramJs.UpdateChannelMessageViews) {
    onUpdate({
      '@type': 'updateMessage',
      chatId: buildApiPeerId(update.channelId, 'channel'),
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
      id: buildApiPeerId(update.channelId, 'channel'),
      chat: {
        lastReadInboxMessageId: update.maxId,
        unreadCount: update.stillUnreadCount,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelOutbox) {
    onUpdate({
      '@type': 'updateChat',
      id: buildApiPeerId(update.channelId, 'channel'),
      chat: {
        lastReadOutboxMessageId: update.maxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelDiscussionInbox) {
    onUpdate({
      '@type': 'updateThreadInfo',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      threadId: update.topMsgId,
      threadInfo: {
        lastReadInboxMessageId: update.readMaxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelDiscussionOutbox) {
    onUpdate({
      '@type': 'updateChat',
      id: buildApiPeerId(update.channelId, 'channel'),
      chat: {
        lastReadOutboxMessageId: update.readMaxId,
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
    const folder = isChatFolder(filter) ? buildApiChatFolder(filter) : undefined;

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
      id: buildApiPeerId(update.participants.chatId, 'chat'),
      replacedMembers,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantAdd) {
    const addedMember = buildChatMember(
      pick(update, ['userId', 'inviterId', 'date']) as GramJs.ChatParticipant,
    );

    onUpdate({
      '@type': 'updateChatMembers',
      id: buildApiPeerId(update.chatId, 'chat'),
      addedMember,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantDelete) {
    onUpdate({
      '@type': 'updateChatMembers',
      id: buildApiPeerId(update.chatId, 'chat'),
      deletedMemberId: buildApiPeerId(update.userId, 'user'),
    });
  } else if (
    update instanceof GramJs.UpdatePinnedMessages
    || update instanceof GramJs.UpdatePinnedChannelMessages
  ) {
    const chatId = update instanceof GramJs.UpdatePinnedMessages
      ? getApiChatIdFromMtpPeer(update.peer)
      : buildApiPeerId(update.channelId, 'channel');

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
    const payload = buildApiNotifyException(update.notifySettings, update.peer.peer);
    scheduleMutedChatUpdate(payload.chatId, payload.muteUntil, onUpdate);
    onUpdate({
      '@type': 'updateNotifyExceptions',
      ...payload,
    });
  } else if (
    update instanceof GramJs.UpdateNotifySettings
    && update.peer instanceof GramJs.NotifyForumTopic
  ) {
    const payload = buildApiNotifyExceptionTopic(
      update.notifySettings, update.peer.peer, update.peer.topMsgId,
    );
    scheduleMutedTopicUpdate(payload.chatId, payload.topicId, payload.muteUntil, onUpdate);
    onUpdate({
      '@type': 'updateTopicNotifyExceptions',
      ...payload,
    });
  } else if (
    update instanceof GramJs.UpdateUserTyping
    || update instanceof GramJs.UpdateChatUserTyping
  ) {
    const id = update instanceof GramJs.UpdateUserTyping
      ? buildApiPeerId(update.userId, 'user')
      : buildApiPeerId(update.chatId, 'chat');

    if (update.action instanceof GramJs.SendMessageEmojiInteraction) {
      onUpdate({
        '@type': 'updateStartEmojiInteraction',
        id,
        emoji: update.action.emoticon,
        messageId: update.action.msgId,
        interaction: buildApiEmojiInteraction(JSON.parse(update.action.interaction.data)),
      });
    } else {
      onUpdate({
        '@type': 'updateChatTypingStatus',
        id,
        typingStatus: buildChatTypingStatus(update),
      });
    }
  } else if (update instanceof GramJs.UpdateChannelUserTyping) {
    const id = buildApiPeerId(update.channelId, 'channel');

    onUpdate({
      '@type': 'updateChatTypingStatus',
      id,
      threadId: update.topMsgId,
      typingStatus: buildChatTypingStatus(update),
    });
  } else if (update instanceof GramJs.UpdateChannel) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
          id: buildApiPeerId(update.channelId, 'channel'),
        });
      }
    } else if (channel instanceof GramJs.ChannelForbidden) {
      const chatId = buildApiPeerId(update.channelId, 'channel');

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
        id: buildApiPeerId(update.channelId, 'channel'),
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
    onUpdate({
      '@type': 'updateUserStatus',
      userId: buildApiPeerId(update.userId, 'user'),
      status: buildApiUserStatus(update.status),
    });
  } else if (update instanceof GramJs.UpdateUser) {
    onUpdate({
      '@type': 'updateRequestUserUpdate',
      id: buildApiPeerId(update.userId, 'user'),
    });
  } else if (update instanceof GramJs.UpdateUserEmojiStatus) {
    const emojiStatus = buildApiUserEmojiStatus(update.emojiStatus);
    onUpdate({
      '@type': 'updateUserEmojiStatus',
      userId: buildApiPeerId(update.userId, 'user'),
      emojiStatus,
    });
  } else if (update instanceof GramJs.UpdateUserName) {
    const apiUserId = buildApiPeerId(update.userId, 'user');
    const updatedUser = localDb.users[apiUserId];

    const user = updatedUser?.mutualContact && !updatedUser.self
      ? pick(update, [])
      : pick(update, ['firstName', 'lastName']);

    const usernames = buildApiUsernames(update);

    onUpdate({
      '@type': 'updateUser',
      id: apiUserId,
      user: {
        ...user,
        usernames,
      },
    });
  } else if (update instanceof GramJs.UpdateUserPhone) {
    const { userId, phone } = update;

    onUpdate({
      '@type': 'updateUser',
      id: buildApiPeerId(userId, 'user'),
      user: { phoneNumber: phone },
    });
  } else if (update instanceof GramJs.UpdatePeerSettings) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _entities, settings } = update;
    if (!_entities) {
      return;
    }

    if (_entities?.length) {
      _entities
        .filter((e) => e instanceof GramJs.User && !e.contact)
        .forEach((user) => {
          onUpdate({
            '@type': 'deleteContact',
            id: buildApiPeerId(user.id, 'user'),
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
            user: {
              ...user,
              ...(settings && { settings: buildApiChatSettings(settings) }),
            },
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
        || (typeof muteUntil === 'number' && Date.now() + getServerTimeOffset() * 1000 < muteUntil * 1000)),
      shouldShowPreviews: Boolean(showPreviews),
    });
  } else if (update instanceof GramJs.UpdatePeerBlocked) {
    onUpdate({
      '@type': 'updatePeerBlocked',
      id: getApiChatIdFromMtpPeer(update.peerId),
      isBlocked: update.blocked,
      isBlockedFromStories: update.blockedMyStoriesFrom,
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
      threadId: update.topMsgId,
      ...buildMessageDraft(update.draft),
    });
  } else if (update instanceof GramJs.UpdateContactsReset) {
    onUpdate({ '@type': 'updateResetContactList' });
  } else if (update instanceof GramJs.UpdateFavedStickers) {
    onUpdate({ '@type': 'updateFavoriteStickers' });
  } else if (update instanceof GramJs.UpdateRecentStickers) {
    onUpdate({ '@type': 'updateRecentStickers' });
  } else if (update instanceof GramJs.UpdateRecentReactions) {
    onUpdate({ '@type': 'updateRecentReactions' });
  } else if (update instanceof GramJs.UpdateMoveStickerSetToTop) {
    if (!update.masks) {
      onUpdate({
        '@type': 'updateMoveStickerSetToTop',
        isCustomEmoji: update.emojis,
        id: update.stickerset.toString(),
      });
    }
  } else if (update instanceof GramJs.UpdateStickerSets) {
    onUpdate({ '@type': 'updateStickerSets' });
  } else if (update instanceof GramJs.UpdateStickerSetsOrder) {
    if (!update.masks) {
      onUpdate({
        '@type': 'updateStickerSetsOrder',
        order: update.order.map((n) => n.toString()),
        isCustomEmoji: update.emojis,
      });
    }
  } else if (update instanceof GramJs.UpdateNewStickerSet) {
    if (update.stickerset instanceof GramJs.messages.StickerSet) {
      const stickerSet = buildStickerSet(update.stickerset.set);
      onUpdate({
        '@type': 'updateStickerSet',
        id: stickerSet.id,
        stickerSet,
      });
    }
  } else if (update instanceof GramJs.UpdateSavedGifs) {
    onUpdate({ '@type': 'updateSavedGifs' });
  } else if (update instanceof GramJs.UpdateGroupCall) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    onUpdate({
      '@type': 'updateGroupCall',
      call: buildApiGroupCall(update.call),
    });
  } else if (update instanceof GramJs.UpdateGroupCallConnection) {
    onUpdate({
      '@type': 'updateGroupCallConnection',
      data: JSON.parse(update.params.data) as GroupCallConnectionData,
      presentation: Boolean(update.presentation),
    });
  } else if (update instanceof GramJs.UpdateGroupCallParticipants) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    onUpdate({
      '@type': 'updateGroupCallParticipants',
      groupCallId: getGroupCallId(update.call),
      participants: update.participants.map(buildApiGroupCallParticipant),
    });
  } else if (update instanceof GramJs.UpdatePendingJoinRequests) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    onUpdate({
      '@type': 'updatePendingJoinRequests',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      recentRequesterIds: update.recentRequesters.map((id) => buildApiPeerId(id, 'user')),
      requestsPending: update.requestsPending,
    });
  } else if (update instanceof GramJs.UpdatePhoneCall) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    onUpdate({
      '@type': 'updatePhoneCall',
      call: buildPhoneCall(update.phoneCall),
    });
  } else if (update instanceof GramJs.UpdatePhoneCallSignalingData) {
    onUpdate({
      '@type': 'updatePhoneCallSignalingData',
      callId: update.phoneCallId.toString(),
      data: Array.from(update.data),
    });
  } else if (update instanceof GramJs.UpdateWebViewResultSent) {
    const { queryId } = update;

    onUpdate({
      '@type': 'updateWebViewResultSent',
      queryId: queryId.toString(),
    });
  } else if (update instanceof GramJs.UpdateBotMenuButton) {
    const {
      botId,
      button,
    } = update;

    const id = buildApiPeerId(botId, 'user');

    onUpdate({
      '@type': 'updateBotMenuButton',
      botId: id,
      button: buildApiBotMenuButton(button),
    });
  } else if (update instanceof GramJs.UpdateTranscribedAudio) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    onUpdate({
      '@type': 'updateTranscribedAudio',
      transcriptionId: update.transcriptionId.toString(),
      text: update.text,
      isPending: update.pending,
    });
  } else if (update instanceof GramJs.UpdateConfig) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }
    onUpdate({ '@type': 'updateConfig' });
  } else if (update instanceof GramJs.UpdateChannelPinnedTopic) {
    onUpdate({
      '@type': 'updatePinnedTopic',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      topicId: update.topicId,
      isPinned: Boolean(update.pinned),
    });
  } else if (update instanceof GramJs.UpdateChannelPinnedTopics) {
    onUpdate({
      '@type': 'updatePinnedTopicsOrder',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      order: update.order || [],
    });
  } else if (update instanceof GramJs.UpdateRecentEmojiStatuses) {
    onUpdate({ '@type': 'updateRecentEmojiStatuses' });
  } else if (update instanceof GramJs.UpdateStory) {
    // eslint-disable-next-line no-underscore-dangle
    const entities = update._entities;
    if (entities) {
      addEntitiesToLocalDb(entities);
      dispatchUserAndChatUpdates(entities);
    }

    const { story } = update;
    const peerId = getApiChatIdFromMtpPeer(update.peer);
    addStoryToLocalDb(story, peerId);

    if (story instanceof GramJs.StoryItemDeleted) {
      onUpdate({
        '@type': 'deleteStory',
        peerId,
        storyId: story.id,
      });
    } else {
      onUpdate({
        '@type': 'updateStory',
        peerId,
        story: buildApiStory(peerId, story) as ApiStory | ApiStorySkipped,
      });
    }
  } else if (update instanceof GramJs.UpdateReadStories) {
    onUpdate({
      '@type': 'updateReadStories',
      peerId: getApiChatIdFromMtpPeer(update.peer),
      lastReadId: update.maxId,
    });
  } else if (update instanceof GramJs.UpdateSentStoryReaction) {
    onUpdate({
      '@type': 'updateSentStoryReaction',
      peerId: getApiChatIdFromMtpPeer(update.peer),
      storyId: update.storyId,
      reaction: buildApiReaction(update.reaction),
    });
  } else if (update instanceof GramJs.UpdateStoriesStealthMode) {
    onUpdate({
      '@type': 'updateStealthMode',
      stealthMode: buildApiStealthMode(update.stealthMode),
    });
  } else if (update instanceof GramJs.UpdateAttachMenuBots) {
    onUpdate({
      '@type': 'updateAttachMenuBots',
    });
  } else if (update instanceof GramJs.UpdateNewAuthorization) {
    onUpdate({
      '@type': 'updateNewAuthorization',
      hash: update.hash.toString(),
      date: update.date,
      device: update.device,
      location: update.location,
      isUnconfirmed: update.unconfirmed,
    });
  } else if (DEBUG) {
    const params = typeof update === 'object' && 'className' in update ? update.className : update;
    log('UNEXPECTED UPDATE', params);
  }
}
