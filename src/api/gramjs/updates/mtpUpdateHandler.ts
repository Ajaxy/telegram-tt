import { Api as GramJs, type Update } from '../../../lib/gramjs';
import { UpdateConnectionState, UpdateServerTimeOffset } from '../../../lib/gramjs/network';

import type { GroupCallConnectionData } from '../../../lib/secret-sauce';
import type {
  ApiMessage, ApiPoll, ApiStory, ApiStorySkipped,
  ApiUpdateConnectionStateType,
  ApiWebPage,
} from '../../types';

import { DEBUG, GENERAL_TOPIC_ID } from '../../../config';
import {
  omit, pick,
} from '../../../util/iteratees';
import { getServerTimeOffset, setServerTimeOffset } from '../../../util/serverTime';
import { buildApiBotCommand, buildApiBotMenuButton } from '../apiBuilders/bots';
import {
  buildApiGroupCall,
  buildApiGroupCallParticipant,
  buildPhoneCall,
  getGroupCallId,
} from '../apiBuilders/calls';
import {
  buildApiChatFolder,
  buildApiChatFromPreview,
  buildChatMember,
  buildChatMembers,
  buildChatTypingStatus,
} from '../apiBuilders/chats';
import {
  buildApiPhoto, buildApiUsernames, buildPrivacyRules,
} from '../apiBuilders/common';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import {
  buildApiMessageExtendedMediaPreview,
  buildBoughtMediaContent,
  buildPoll,
  buildPollFromMedia,
  buildPollResults,
  buildWebPage,
  buildWebPageFromMedia,
} from '../apiBuilders/messageContent';
import {
  buildApiMessage,
  buildApiMessageFromNotification,
  buildApiMessageFromShort,
  buildApiMessageFromShortChat,
  buildApiQuickReply,
  buildMessageDraft,
} from '../apiBuilders/messages';
import {
  buildLangStrings,
  buildPrivacyKey,
} from '../apiBuilders/misc';
import { buildApiCurrencyAmount } from '../apiBuilders/payments';
import {
  buildApiEmojiStatus,
  buildApiPeerId,
  buildApiPeerNotifySettings,
  getApiChatIdFromMtpPeer,
} from '../apiBuilders/peers';
import {
  buildApiPaidReactionPrivacy,
  buildApiReaction,
  buildMessageReactions,
} from '../apiBuilders/reactions';
import { buildApiStealthMode, buildApiStory } from '../apiBuilders/stories';
import { buildApiEmojiInteraction, buildStickerSet } from '../apiBuilders/symbols';
import {
  buildApiPeerSettings,
  buildApiUserStatus,
} from '../apiBuilders/users';
import {
  buildChatPhotoForLocalDb,
  buildMessageFromUpdate,
} from '../gramjsBuilders';
import {
  addPhotoToLocalDb,
  addStoryToLocalDb,
} from '../helpers/localDb';
import {
  isChatFolder,
  log,
  resolveMessageApiChatId,
  serializeBytes,
} from '../helpers/misc';
import localDb from '../localDb';
import { scheduleMutedChatUpdate, scheduleMutedTopicUpdate } from '../scheduleUnmute';
import { sendApiUpdate } from './apiUpdateEmitter';
import { processMessageAndUpdateThreadInfo } from './entityProcessor';

import LocalUpdatePremiumFloodWait from './UpdatePremiumFloodWait';
import { LocalUpdateChannelPts, LocalUpdatePts } from './UpdatePts';

export function updater(update: Update) {
  if (update instanceof UpdateServerTimeOffset) {
    setServerTimeOffset(update.timeOffset);

    sendApiUpdate({
      '@type': 'updateServerTimeOffset',
      serverTimeOffset: update.timeOffset,
    });
  } else if (update instanceof UpdateConnectionState) {
    let connectionState: ApiUpdateConnectionStateType;

    switch (update.state) {
      case UpdateConnectionState.disconnected:
        connectionState = 'connectionStateConnecting';
        break;
      case UpdateConnectionState.broken:
        connectionState = 'connectionStateBroken';
        break;
      case UpdateConnectionState.connected:
      default:
        connectionState = 'connectionStateReady';
        break;
    }

    sendApiUpdate({
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
    let poll: ApiPoll | undefined;
    let webPage: ApiWebPage | undefined;
    let shouldForceReply: boolean | undefined;

    if (update instanceof GramJs.UpdateShortChatMessage) {
      message = buildApiMessageFromShortChat(update);
    } else if (update instanceof GramJs.UpdateShortMessage) {
      message = buildApiMessageFromShort(update);
    } else {
      const mtpMessage = update.message;
      // TODO Remove if proven not reproducing
      if (mtpMessage instanceof GramJs.MessageEmpty) {
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.error('Unexpected update:', update.className, update);
        }

        return;
      }

      processMessageAndUpdateThreadInfo(mtpMessage);

      message = buildApiMessage(mtpMessage)!;

      if (mtpMessage instanceof GramJs.Message) {
        poll = mtpMessage.media && buildPollFromMedia(mtpMessage.media);
        webPage = mtpMessage.media && buildWebPageFromMedia(mtpMessage.media);
      }

      shouldForceReply = 'replyMarkup' in update.message
        && update.message?.replyMarkup instanceof GramJs.ReplyKeyboardForceReply
        && (!update.message.replyMarkup.selective || message.isMentioned);
    }

    if (update instanceof GramJs.UpdateNewScheduledMessage) {
      sendApiUpdate({
        '@type': 'updateScheduledMessage',
        id: message.id,
        chatId: message.chatId,
        message,
        poll,
        webPage,
        isFromNew: true,
      });
    } else {
      sendApiUpdate({
        '@type': 'updateMessage',
        id: message.id,
        chatId: message.chatId,
        message,
        shouldForceReply,
        poll,
        webPage,
        isFromNew: true,
      });
    }

    // Some updates to a Chat/Channel don't have a dedicated update class.
    // We can get info on some updates from Service Messages.
    if (update.message instanceof GramJs.MessageService) {
      const { action } = update.message;

      if (action instanceof GramJs.MessageActionChatEditTitle) {
        sendApiUpdate({
          '@type': 'updateChat',
          id: message.chatId,
          chat: {
            title: action.title,
          },
        });
      } else if (action instanceof GramJs.MessageActionChatEditPhoto) {
        const apiPhoto = action.photo instanceof GramJs.Photo && buildApiPhoto(action.photo);
        if (!apiPhoto) return;

        const photo = buildChatPhotoForLocalDb(action.photo);

        const localDbChatId = resolveMessageApiChatId(update.message)!;
        if (localDb.chats[localDbChatId]) {
          localDb.chats[localDbChatId].photo = photo;
        }
        addPhotoToLocalDb(action.photo);

        sendApiUpdate({
          '@type': 'updateNewProfilePhoto',
          peerId: message.chatId,
          photo: apiPhoto,
        });
      } else if (action instanceof GramJs.MessageActionChatDeletePhoto) {
        const localDbChatId = resolveMessageApiChatId(update.message)!;
        if (localDb.chats[localDbChatId]) {
          localDb.chats[localDbChatId].photo = new GramJs.ChatPhotoEmpty();
        }

        sendApiUpdate({
          '@type': 'updateDeleteProfilePhoto',
          peerId: message.chatId,
        });
      } else if (action instanceof GramJs.MessageActionChatDeleteUser) {
        if (update._entities && update._entities.some((e): e is GramJs.User => (
          e instanceof GramJs.User && Boolean(e.self) && e.id === action.userId
        ))) {
          sendApiUpdate({
            '@type': 'updateChat',
            id: message.chatId,
            chat: {
              isForbidden: true,
              isNotJoined: true,
            },
          });
        }
      } else if (action instanceof GramJs.MessageActionChatAddUser) {
        if (update._entities && update._entities.some((e): e is GramJs.User => (
          e instanceof GramJs.User && Boolean(e.self) && action.users.includes(e.id)
        ))) {
          sendApiUpdate({
            '@type': 'updateChatJoin',
            id: message.chatId,
          });
        }
      } else if (action instanceof GramJs.MessageActionGroupCall) {
        const groupCall = action.call instanceof GramJs.InputGroupCall ? action.call : undefined;
        if (!action.duration && groupCall) {
          sendApiUpdate({
            '@type': 'updateGroupCallChatId',
            chatId: message.chatId,
            call: {
              id: groupCall.id.toString(),
              accessHash: groupCall.accessHash.toString(),
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

        sendApiUpdate({
          '@type': 'updateTopic',
          chatId: getApiChatIdFromMtpPeer(update.message.peerId),
          topicId,
        });
      } else if (action instanceof GramJs.MessageActionTopicCreate) {
        sendApiUpdate({
          '@type': 'updateTopics',
          chatId: getApiChatIdFromMtpPeer(update.message.peerId),
        });
      }
    }
  } else if (update instanceof GramJs.UpdateQuickReplyMessage) {
    const message = buildApiMessage(update.message);
    if (!message) return;

    const poll = update.message instanceof GramJs.Message && update.message.media
      ? buildPollFromMedia(update.message.media) : undefined;
    const webPage = update.message instanceof GramJs.Message && update.message.media
      ? buildWebPageFromMedia(update.message.media) : undefined;

    sendApiUpdate({
      '@type': 'updateQuickReplyMessage',
      id: message.id,
      message,
      poll,
      webPage,
    });
  } else if (update instanceof GramJs.UpdateDeleteQuickReplyMessages) {
    sendApiUpdate({
      '@type': 'deleteQuickReplyMessages',
      quickReplyId: update.shortcutId,
      messageIds: update.messages,
    });
  } else if (update instanceof GramJs.UpdateQuickReplies) {
    const quickReplies = update.quickReplies.map(buildApiQuickReply);
    sendApiUpdate({
      '@type': 'updateQuickReplies',
      quickReplies,
    });
  } else if (update instanceof GramJs.UpdateNewQuickReply) {
    const quickReply = buildApiQuickReply(update.quickReply);
    sendApiUpdate({
      '@type': 'updateQuickReplies',
      quickReplies: [quickReply],
    });
  } else if (update instanceof GramJs.UpdateDeleteQuickReply) {
    sendApiUpdate({
      '@type': 'deleteQuickReply',
      quickReplyId: update.shortcutId,
    });
  } else if (
    update instanceof GramJs.UpdateEditMessage
    || update instanceof GramJs.UpdateEditChannelMessage
  ) {
    const mtpMessage = update.message;
    // TODO Remove if proven not reproducing
    if (mtpMessage instanceof GramJs.MessageEmpty) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Unexpected update:', update.className, update);
      }

      return;
    }

    processMessageAndUpdateThreadInfo(mtpMessage);

    // Workaround for a weird server behavior when own message is marked as incoming
    const message = omit(buildApiMessage(mtpMessage)!, ['isOutgoing']);

    const poll = mtpMessage instanceof GramJs.Message && mtpMessage.media
      ? buildPollFromMedia(mtpMessage.media) : undefined;

    const webPage = mtpMessage instanceof GramJs.Message && mtpMessage.media
      ? buildWebPageFromMedia(mtpMessage.media) : undefined;

    sendApiUpdate({
      '@type': 'updateMessage',
      id: message.id,
      chatId: message.chatId,
      message,
      poll,
      webPage,
    });
  } else if (update instanceof GramJs.UpdateMessageReactions) {
    sendApiUpdate({
      '@type': 'updateMessageReactions',
      id: update.msgId,
      chatId: getApiChatIdFromMtpPeer(update.peer),
      reactions: buildMessageReactions(update.reactions),
    });
  } else if (update instanceof GramJs.UpdateMessageExtendedMedia) {
    const chatId = getApiChatIdFromMtpPeer(update.peer);
    const isBought = update.extendedMedia[0] instanceof GramJs.MessageExtendedMedia;
    if (isBought) {
      const boughtMedia = buildBoughtMediaContent(update.extendedMedia);

      if (!boughtMedia?.length) return;

      sendApiUpdate({
        '@type': 'updateMessageExtendedMedia',
        id: update.msgId,
        chatId,
        isBought,
        extendedMedia: boughtMedia,
      });
      return;
    }

    const previewMedia = !isBought ? update.extendedMedia
      .filter((m): m is GramJs.MessageExtendedMediaPreview => m instanceof GramJs.MessageExtendedMediaPreview)
      .map((m) => buildApiMessageExtendedMediaPreview(m))
      .filter(Boolean) : undefined;

    if (!previewMedia?.length) return;

    sendApiUpdate({
      '@type': 'updateMessageExtendedMedia',
      id: update.msgId,
      chatId,
      extendedMedia: previewMedia,
    });
  } else if (update instanceof GramJs.UpdateDeleteMessages) {
    sendApiUpdate({
      '@type': 'deleteMessages',
      ids: update.messages,
    });
  } else if (update instanceof GramJs.UpdateDeleteScheduledMessages) {
    sendApiUpdate({
      '@type': 'deleteScheduledMessages',
      ids: update.messages,
      newIds: update.sentMessages,
      chatId: getApiChatIdFromMtpPeer(update.peer),
    });
  } else if (update instanceof GramJs.UpdateDeleteChannelMessages) {
    const chatId = buildApiPeerId(update.channelId, 'channel');

    sendApiUpdate({
      '@type': 'deleteMessages',
      ids: update.messages,
      chatId,
    });
  } else if (update instanceof GramJs.UpdateServiceNotification) {
    if (update.popup) {
      sendApiUpdate({
        '@type': 'error',
        error: {
          message: update.message,
        },
      });
    } else {
      const currentDate = Date.now() / 1000 + getServerTimeOffset();
      const message = buildApiMessageFromNotification(update, currentDate);

      processMessageAndUpdateThreadInfo(buildMessageFromUpdate(message.id, message.chatId, update));

      sendApiUpdate({
        '@type': 'updateServiceNotification',
        message,
      });
    }
  } else if (update instanceof GramJs.UpdateReadMessagesContents) {
    sendApiUpdate({
      '@type': 'updateCommonBoxMessages',
      ids: update.messages,
      messageUpdate: {
        hasUnreadMention: false,
        isMediaUnread: false,
      },
    });
  } else if (update instanceof GramJs.UpdateChannelReadMessagesContents) {
    sendApiUpdate({
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

      sendApiUpdate({
        '@type': 'updateMessagePoll',
        pollId: String(pollId),
        pollUpdate: apiPoll,
      });
    } else {
      const pollResults = buildPollResults(results);
      sendApiUpdate({
        '@type': 'updateMessagePoll',
        pollId: String(pollId),
        pollUpdate: { results: pollResults },
      });
    }
  } else if (update instanceof GramJs.UpdateMessagePollVote) {
    sendApiUpdate({
      '@type': 'updateMessagePollVote',
      pollId: String(update.pollId),
      peerId: getApiChatIdFromMtpPeer(update.peer),
      options: update.options.map(serializeBytes),
    });
  } else if (update instanceof GramJs.UpdateChannelMessageViews) {
    sendApiUpdate({
      '@type': 'updateMessage',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      id: update.id,
      message: { viewsCount: update.views },
    });
  } else if (update instanceof GramJs.UpdateChannelMessageForwards) {
    sendApiUpdate({
      '@type': 'updateMessage',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      id: update.id,
      message: { forwardsCount: update.forwards },
    });

    // Chats
  } else if (update instanceof GramJs.UpdateReadHistoryInbox) {
    sendApiUpdate({
      '@type': 'updateChatInbox',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        lastReadInboxMessageId: update.maxId,
        unreadCount: update.stillUnreadCount,
      },
    });
  } else if (update instanceof GramJs.UpdateReadHistoryOutbox) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        lastReadOutboxMessageId: update.maxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelInbox) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: buildApiPeerId(update.channelId, 'channel'),
      chat: {
        lastReadInboxMessageId: update.maxId,
        unreadCount: update.stillUnreadCount,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelOutbox) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: buildApiPeerId(update.channelId, 'channel'),
      chat: {
        lastReadOutboxMessageId: update.maxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelDiscussionInbox) {
    sendApiUpdate({
      '@type': 'updateThreadInfo',
      threadInfo: {
        chatId: buildApiPeerId(update.channelId, 'channel'),
        threadId: update.topMsgId,
        lastReadInboxMessageId: update.readMaxId,
      },
    });
  } else if (update instanceof GramJs.UpdateReadChannelDiscussionOutbox) {
    sendApiUpdate({
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
    sendApiUpdate({
      '@type': 'updateChatPinned',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      isPinned: update.pinned || false,
    });
  } else if (update instanceof GramJs.UpdatePinnedDialogs) {
    const ids = update.order?.filter(
      (dp): dp is GramJs.DialogPeer => dp instanceof GramJs.DialogPeer)
      .map((dp) => getApiChatIdFromMtpPeer(dp.peer));

    sendApiUpdate({
      '@type': 'updatePinnedChatIds',
      ids,
      folderId: update.folderId || undefined,
    });
  } else if (
    update instanceof GramJs.UpdateSavedDialogPinned
    && update.peer instanceof GramJs.DialogPeer
  ) {
    sendApiUpdate({
      '@type': 'updateSavedDialogPinned',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      isPinned: update.pinned || false,
    });
  } else if (update instanceof GramJs.UpdatePinnedSavedDialogs) {
    const ids = update.order
      ? update.order
        .filter((dp): dp is GramJs.DialogPeer => dp instanceof GramJs.DialogPeer)
        .map((dp) => getApiChatIdFromMtpPeer(dp.peer))
      : [];

    sendApiUpdate({
      '@type': 'updatePinnedSavedDialogIds',
      ids,
    });
  } else if (update instanceof GramJs.UpdateFolderPeers) {
    update.folderPeers.forEach((folderPeer) => {
      const { folderId, peer } = folderPeer;

      sendApiUpdate({
        '@type': 'updateChatListType',
        id: getApiChatIdFromMtpPeer(peer),
        folderId,
      });
    });
  } else if (update instanceof GramJs.UpdateDialogFilter) {
    const { id, filter } = update;
    const folder = isChatFolder(filter) ? buildApiChatFolder(filter) : undefined;

    sendApiUpdate({
      '@type': 'updateChatFolder',
      id,
      folder,
    });
  } else if (update instanceof GramJs.UpdateDialogFilterOrder) {
    sendApiUpdate({
      '@type': 'updateChatFoldersOrder',
      orderedIds: update.order,
    });
  } else if (update instanceof GramJs.UpdateChatParticipants) {
    const replacedMembers = buildChatMembers(update.participants);

    sendApiUpdate({
      '@type': 'updateChatMembers',
      id: buildApiPeerId(update.participants.chatId, 'chat'),
      replacedMembers,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantAdd) {
    const addedMember = buildChatMember(
      pick(update, ['userId', 'inviterId', 'date']) as GramJs.ChatParticipant,
    );

    sendApiUpdate({
      '@type': 'updateChatMembers',
      id: buildApiPeerId(update.chatId, 'chat'),
      addedMember,
    });
  } else if (update instanceof GramJs.UpdateChatParticipantDelete) {
    sendApiUpdate({
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

    sendApiUpdate({
      '@type': 'updatePinnedIds',
      chatId,
      messageIds: update.messages,
      isPinned: update.pinned,
    });
  } else if (
    update instanceof GramJs.UpdateUserTyping
    || update instanceof GramJs.UpdateChatUserTyping
  ) {
    const id = update instanceof GramJs.UpdateUserTyping
      ? buildApiPeerId(update.userId, 'user')
      : buildApiPeerId(update.chatId, 'chat');

    if (update.action instanceof GramJs.SendMessageEmojiInteraction) {
      sendApiUpdate({
        '@type': 'updateStartEmojiInteraction',
        id,
        emoji: update.action.emoticon,
        messageId: update.action.msgId,
        interaction: buildApiEmojiInteraction(JSON.parse(update.action.interaction.data)),
      });
    } else {
      sendApiUpdate({
        '@type': 'updateChatTypingStatus',
        id,
        typingStatus: buildChatTypingStatus(update),
      });
    }
  } else if (update instanceof GramJs.UpdateChannelUserTyping) {
    const id = buildApiPeerId(update.channelId, 'channel');

    sendApiUpdate({
      '@type': 'updateChatTypingStatus',
      id,
      threadId: update.topMsgId,
      typingStatus: buildChatTypingStatus(update),
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
        sendApiUpdate({
          '@type': 'updateChat',
          id: chat.id,
          chat,
        });

        sendApiUpdate({
          '@type': chat.isNotJoined ? 'updateChatLeave' : 'updateChatJoin',
          id: buildApiPeerId(update.channelId, 'channel'),
        });
      }
    } else if (channel instanceof GramJs.ChannelForbidden) {
      const chatId = buildApiPeerId(update.channelId, 'channel');

      sendApiUpdate({
        '@type': 'updateChat',
        id: chatId,
        chat: {
          isRestricted: true,
        },
      });

      sendApiUpdate({
        '@type': 'updateChatLeave',
        id: chatId,
      });
    } else if (_entities.length === 0) {
      // The link to the discussion group may have been changed.
      // No corresponding update available at this moment https://core.telegram.org/type/Updates
      sendApiUpdate({
        '@type': 'resetMessages',
        id: buildApiPeerId(update.channelId, 'channel'),
      });
    }
  } else if (
    update instanceof GramJs.UpdateDialogUnreadMark
    && update.peer instanceof GramJs.DialogPeer
  ) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer.peer),
      chat: {
        hasUnreadMark: update.unread,
      },
    });
  } else if (update instanceof GramJs.UpdateChatDefaultBannedRights) {
    sendApiUpdate({
      '@type': 'updateChat',
      id: getApiChatIdFromMtpPeer(update.peer),
      chat: {
        defaultBannedRights: omitVirtualClassFields(update.defaultBannedRights),
      },
    });

    // Users
  } else if (update instanceof GramJs.UpdateUserStatus) {
    sendApiUpdate({
      '@type': 'updateUserStatus',
      userId: buildApiPeerId(update.userId, 'user'),
      status: buildApiUserStatus(update.status),
    });
  } else if (update instanceof GramJs.UpdateUser) {
    sendApiUpdate({
      '@type': 'updateRequestUserUpdate',
      id: buildApiPeerId(update.userId, 'user'),
    });
  } else if (update instanceof GramJs.UpdateUserEmojiStatus) {
    const emojiStatus = buildApiEmojiStatus(update.emojiStatus);
    sendApiUpdate({
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

    sendApiUpdate({
      '@type': 'updateUser',
      id: apiUserId,
      user: {
        ...user,
        usernames,
      },
    });
  } else if (update instanceof GramJs.UpdateUserPhone) {
    const { userId, phone } = update;

    sendApiUpdate({
      '@type': 'updateUser',
      id: buildApiPeerId(userId, 'user'),
      user: { phoneNumber: phone },
    });
  } else if (update instanceof GramJs.UpdatePeerSettings) {
    const { peer, settings } = update;
    const peerId = getApiChatIdFromMtpPeer(peer);
    const apiSettings = buildApiPeerSettings(settings);
    sendApiUpdate({
      '@type': 'updatePeerSettings',
      id: peerId,
      settings: apiSettings,
    });
  } else if (update instanceof GramJs.UpdateNotifySettings) {
    const {
      notifySettings,
      peer: notifyPeer,
    } = update;
    const className = notifyPeer.className;
    const settings = buildApiPeerNotifySettings(notifySettings);

    if (notifyPeer instanceof GramJs.NotifyPeer) {
      const peerId = getApiChatIdFromMtpPeer(notifyPeer.peer);
      if (settings.mutedUntil) {
        scheduleMutedChatUpdate(peerId, settings.mutedUntil, sendApiUpdate);
      }
      sendApiUpdate({
        '@type': 'updateChatNotifySettings',
        chatId: peerId,
        settings,
      });
      return;
    }

    if (notifyPeer instanceof GramJs.NotifyForumTopic) {
      const peerId = getApiChatIdFromMtpPeer(notifyPeer.peer);
      if (settings.mutedUntil) {
        scheduleMutedTopicUpdate(peerId, notifyPeer.topMsgId, settings.mutedUntil, sendApiUpdate);
      }
      sendApiUpdate({
        '@type': 'updateTopicNotifySettings',
        chatId: peerId,
        topicId: notifyPeer.topMsgId,
        settings,
      });
      return;
    }

    const peerType = className === 'NotifyUsers'
      ? 'users'
      : (className === 'NotifyChats'
        ? 'groups'
        : (className === 'NotifyBroadcasts'
          ? 'channels'
          : undefined
        )
      );

    if (!peerType) {
      return;
    }

    sendApiUpdate({
      '@type': 'updateDefaultNotifySettings',
      peerType,
      settings,
    });
  } else if (update instanceof GramJs.UpdatePeerBlocked) {
    sendApiUpdate({
      '@type': 'updatePeerBlocked',
      id: getApiChatIdFromMtpPeer(update.peerId),
      isBlocked: update.blocked,
      isBlockedFromStories: update.blockedMyStoriesFrom,
    });
  } else if (update instanceof GramJs.UpdatePrivacy) {
    const key = buildPrivacyKey(update.key);
    if (key) {
      sendApiUpdate({
        '@type': 'updatePrivacy',
        key,
        rules: buildPrivacyRules(update.rules),
      });
    }

    // Misc
  } else if (update instanceof GramJs.UpdateDraftMessage) {
    sendApiUpdate({
      '@type': 'draftMessage',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      threadId: update.topMsgId,
      draft: buildMessageDraft(update.draft),
    });
  } else if (update instanceof GramJs.UpdateContactsReset) {
    sendApiUpdate({ '@type': 'updateResetContactList' });
  } else if (update instanceof GramJs.UpdateFavedStickers) {
    sendApiUpdate({ '@type': 'updateFavoriteStickers' });
  } else if (update instanceof GramJs.UpdateRecentStickers) {
    sendApiUpdate({ '@type': 'updateRecentStickers' });
  } else if (update instanceof GramJs.UpdateRecentReactions) {
    sendApiUpdate({ '@type': 'updateRecentReactions' });
  } else if (update instanceof GramJs.UpdateSavedReactionTags) {
    sendApiUpdate({ '@type': 'updateSavedReactionTags' });
  } else if (update instanceof GramJs.UpdateMoveStickerSetToTop) {
    if (!update.masks) {
      sendApiUpdate({
        '@type': 'updateMoveStickerSetToTop',
        isCustomEmoji: update.emojis,
        id: update.stickerset.toString(),
      });
    }
  } else if (update instanceof GramJs.UpdateStickerSets) {
    sendApiUpdate({ '@type': 'updateStickerSets' });
  } else if (update instanceof GramJs.UpdateStickerSetsOrder) {
    if (!update.masks) {
      sendApiUpdate({
        '@type': 'updateStickerSetsOrder',
        order: update.order.map((n) => n.toString()),
        isCustomEmoji: update.emojis,
      });
    }
  } else if (update instanceof GramJs.UpdateNewStickerSet) {
    if (update.stickerset instanceof GramJs.messages.StickerSet) {
      const stickerSet = buildStickerSet(update.stickerset.set);
      sendApiUpdate({
        '@type': 'updateStickerSet',
        id: stickerSet.id,
        stickerSet,
      });
    }
  } else if (update instanceof GramJs.UpdateSavedGifs) {
    sendApiUpdate({ '@type': 'updateSavedGifs' });
  } else if (update instanceof GramJs.UpdateGroupCall) {
    sendApiUpdate({
      '@type': 'updateGroupCall',
      call: buildApiGroupCall(update.call),
    });
  } else if (update instanceof GramJs.UpdateGroupCallConnection) {
    sendApiUpdate({
      '@type': 'updateGroupCallConnection',
      data: JSON.parse(update.params.data) as GroupCallConnectionData,
      presentation: Boolean(update.presentation),
    });
  } else if (update instanceof GramJs.UpdateGroupCallParticipants) {
    const groupCallId = getGroupCallId(update.call);
    if (groupCallId) {
      sendApiUpdate({
        '@type': 'updateGroupCallParticipants',
        groupCallId,
        participants: update.participants.map(buildApiGroupCallParticipant),
      });
    }
  } else if (update instanceof GramJs.UpdatePendingJoinRequests) {
    sendApiUpdate({
      '@type': 'updatePendingJoinRequests',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      recentRequesterIds: update.recentRequesters.map((id) => buildApiPeerId(id, 'user')),
      requestsPending: update.requestsPending,
    });
  } else if (update instanceof GramJs.UpdatePhoneCall) {
    sendApiUpdate({
      '@type': 'updatePhoneCall',
      call: buildPhoneCall(update.phoneCall),
    });
  } else if (update instanceof GramJs.UpdatePhoneCallSignalingData) {
    sendApiUpdate({
      '@type': 'updatePhoneCallSignalingData',
      callId: update.phoneCallId.toString(),
      data: Array.from(update.data),
    });
  } else if (update instanceof GramJs.UpdateWebViewResultSent) {
    const { queryId } = update;

    sendApiUpdate({
      '@type': 'updateWebViewResultSent',
      queryId: queryId.toString(),
    });
  } else if (update instanceof GramJs.UpdateWebPage || update instanceof GramJs.UpdateChannelWebPage) {
    const webPage = buildWebPage(update.webpage);
    if (webPage) {
      sendApiUpdate({
        '@type': 'updateWebPage',
        webPage,
      });
    }
  } else if (update instanceof GramJs.UpdateBotMenuButton) {
    const {
      botId,
      button,
    } = update;

    const id = buildApiPeerId(botId, 'user');

    sendApiUpdate({
      '@type': 'updateBotMenuButton',
      botId: id,
      button: buildApiBotMenuButton(button),
    });
  } else if (update instanceof GramJs.UpdateBotCommands) {
    const {
      botId,
      commands,
    } = update;

    const id = buildApiPeerId(botId, 'user');
    const commandsArray = commands.map((command) => buildApiBotCommand(id, command));
    sendApiUpdate({
      '@type': 'updateBotCommands',
      botId: id,
      commands: commandsArray.length ? commandsArray : undefined,
    });
  } else if (update instanceof GramJs.UpdateTranscribedAudio) {
    sendApiUpdate({
      '@type': 'updateTranscribedAudio',
      transcriptionId: update.transcriptionId.toString(),
      text: update.text,
      isPending: update.pending,
    });
  } else if (update instanceof GramJs.UpdateConfig) {
    sendApiUpdate({ '@type': 'updateConfig' });
  } else if (update instanceof GramJs.UpdatePinnedForumTopic) {
    sendApiUpdate({
      '@type': 'updatePinnedTopic',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      topicId: update.topicId,
      isPinned: Boolean(update.pinned),
    });
  } else if (update instanceof GramJs.UpdatePinnedForumTopics) {
    sendApiUpdate({
      '@type': 'updatePinnedTopicsOrder',
      chatId: getApiChatIdFromMtpPeer(update.peer),
      order: update.order || [],
    });
  } else if (update instanceof GramJs.UpdateRecentEmojiStatuses) {
    sendApiUpdate({ '@type': 'updateRecentEmojiStatuses' });
  } else if (update instanceof GramJs.UpdateStory) {
    const { story } = update;
    const peerId = getApiChatIdFromMtpPeer(update.peer);
    const apiStory = buildApiStory(peerId, story) as ApiStory | ApiStorySkipped;
    addStoryToLocalDb(story, peerId); // Add after building to prevent repair info overwrite

    if (story instanceof GramJs.StoryItemDeleted) {
      sendApiUpdate({
        '@type': 'deleteStory',
        peerId,
        storyId: story.id,
      });
    } else {
      sendApiUpdate({
        '@type': 'updateStory',
        peerId,
        story: apiStory,
      });
    }
  } else if (update instanceof GramJs.UpdateReadStories) {
    sendApiUpdate({
      '@type': 'updateReadStories',
      peerId: getApiChatIdFromMtpPeer(update.peer),
      lastReadId: update.maxId,
    });
  } else if (update instanceof GramJs.UpdateSentStoryReaction) {
    const reaction = buildApiReaction(update.reaction);
    sendApiUpdate({
      '@type': 'updateSentStoryReaction',
      peerId: getApiChatIdFromMtpPeer(update.peer),
      storyId: update.storyId,
      reaction,
    });
  } else if (update instanceof GramJs.UpdateStoriesStealthMode) {
    sendApiUpdate({
      '@type': 'updateStealthMode',
      stealthMode: buildApiStealthMode(update.stealthMode),
    });
  } else if (update instanceof GramJs.UpdateAttachMenuBots) {
    sendApiUpdate({
      '@type': 'updateAttachMenuBots',
    });
  } else if (update instanceof GramJs.UpdateNewAuthorization) {
    sendApiUpdate({
      '@type': 'updateNewAuthorization',
      hash: update.hash.toString(),
      date: update.date,
      device: update.device,
      location: update.location,
      isUnconfirmed: update.unconfirmed,
    });
  } else if (update instanceof GramJs.UpdateChannelViewForumAsMessages) {
    sendApiUpdate({
      '@type': 'updateViewForumAsMessages',
      chatId: buildApiPeerId(update.channelId, 'channel'),
      isEnabled: update.enabled ? true : undefined,
    });
  } else if (update instanceof GramJs.UpdateStarsBalance) {
    const balance = buildApiCurrencyAmount(update.balance);
    if (!balance) {
      return;
    }
    sendApiUpdate({
      '@type': 'updateStarsBalance',
      balance,
    });
  } else if (update instanceof GramJs.UpdatePaidReactionPrivacy) {
    sendApiUpdate({
      '@type': 'updatePaidReactionPrivacy',
      private: buildApiPaidReactionPrivacy(update.private),
    });
  } else if (update instanceof GramJs.UpdateLangPackTooLong) {
    sendApiUpdate({
      '@type': 'updateLangPackTooLong',
      langCode: update.langCode,
    });
  } else if (update instanceof GramJs.UpdateLangPack) {
    const { strings, keysToRemove } = buildLangStrings(update.difference.strings);
    sendApiUpdate({
      '@type': 'updateLangPack',
      version: update.difference.version,
      strings,
      keysToRemove,
    });
  } else if (update instanceof LocalUpdatePremiumFloodWait) { // Local updates
    sendApiUpdate({
      '@type': 'updatePremiumFloodWait',
      isUpload: update.isUpload,
    });
  } else if (update instanceof LocalUpdatePts || update instanceof LocalUpdateChannelPts) {
    // Do nothing, handled on the manager side
  } else if (update instanceof GramJs.UpdateMessageID || update instanceof GramJs.UpdateShortSentMessage) {
    // Do nothing, handled when sending the message
  } else if (DEBUG) {
    const params = typeof update === 'object' && 'className' in update ? update.className : update;
    log('UNEXPECTED UPDATE', params);
  }
}
