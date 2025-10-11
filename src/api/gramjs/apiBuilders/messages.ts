import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAttachment,
  ApiChat,
  ApiContact,
  ApiDraft,
  ApiFactCheck,
  ApiInputMessageReplyInfo,
  ApiInputReplyInfo,
  ApiInputSuggestedPostInfo,
  ApiMediaTodo,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageForwardInfo,
  ApiMessageReportResult,
  ApiNewMediaTodo,
  ApiNewPoll,
  ApiPeer,
  ApiPhoto,
  ApiPoll,
  ApiPreparedInlineMessage,
  ApiQuickReply,
  ApiReplyInfo,
  ApiSearchPostsFlood,
  ApiSponsoredMessage,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiSuggestedPost,
  ApiThreadInfo,
  ApiVideo,
  MediaContent,
} from '../../types';
import { ApiMessageEntityTypes, MAIN_THREAD_ID } from '../../types';

import {
  DELETED_COMMENTS_CHANNEL_ID,
  SERVICE_NOTIFICATIONS_USER_ID,
  SPONSORED_MESSAGE_CACHE_MS,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getEmojiOnlyCountForMessage } from '../../../global/helpers/getEmojiOnlyCountForMessage';
import { addTimestampEntities } from '../../../util/dates/timestamp';
import { omitUndefined, pick } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { interpolateArray } from '../../../util/waveform';
import {
  buildApiCurrencyAmount,
} from '../apiBuilders/payments';
import { buildPeer, getEntityTypeById } from '../gramjsBuilders';
import {
  addDocumentToLocalDb,
  addPhotoToLocalDb,
  addWebDocumentToLocalDb,
  type MediaRepairContext,
} from '../helpers/localDb';
import { resolveMessageApiChatId, serializeBytes } from '../helpers/misc';
import {
  buildApiBotInlineMediaResult,
  buildApiBotInlineResult,
  buildApiInlineQueryPeerType,
  buildReplyButtons,
} from './bots';
import {
  buildApiFormattedText,
  buildApiPhoto,
} from './common';
import { type OmitVirtualFields } from './helpers';
import { buildApiMessageAction } from './messageActions';
import { buildMessageContent, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiRestrictionReasons } from './misc';
import { buildApiPeerColor, buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildMessageReactions } from './reactions';

const LOCAL_MESSAGES_LIMIT = 1e6; // 1M

const LOCAL_MEDIA_UPLOADING_TEMP_ID = 'temp';
const INPUT_WAVEFORM_LENGTH = 63;
const MIN_SCHEDULED_PERIOD = 10;

let localMessageCounter = 0;
function getNextLocalMessageId(lastMessageId = 0) {
  return lastMessageId + (++localMessageCounter / LOCAL_MESSAGES_LIMIT);
}

let currentUserId!: string;

export function setMessageBuilderCurrentUserId(_currentUserId: string) {
  currentUserId = _currentUserId;
}

export function buildApiSponsoredMessage(
  mtpMessage: GramJs.SponsoredMessage, chatId: string,
): ApiSponsoredMessage | undefined {
  const {
    message, entities, randomId, recommended, sponsorInfo, additionalInfo, buttonText, canReport, title, url, color,
  } = mtpMessage;

  let photo: ApiPhoto | undefined;
  if (mtpMessage.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(mtpMessage.photo);
    photo = buildApiPhoto(mtpMessage.photo);
  }

  let media: MediaContent | undefined;
  if (mtpMessage.media) {
    media = buildMessageMediaContent(mtpMessage.media);
  }

  return {
    chatId,
    randomId: serializeBytes(randomId),
    expiresAt: Math.round(Date.now() / 1000) + SPONSORED_MESSAGE_CACHE_MS,
    isRecommended: recommended,
    sponsorInfo,
    additionalInfo,
    buttonText,
    canReport,
    title,
    url,
    peerColor: color && buildApiPeerColor(color),
    photo,
    content: {
      ...media,
      text: buildMessageTextContent(message, entities),
    },
  };
}

export function buildApiMessage(mtpMessage: GramJs.TypeMessage): ApiMessage | undefined {
  const chatId = resolveMessageApiChatId(mtpMessage);
  if (
    !chatId
    || !(mtpMessage instanceof GramJs.Message || mtpMessage instanceof GramJs.MessageService)) {
    return undefined;
  }

  return buildApiMessageWithChatId(chatId, mtpMessage);
}

export function buildApiMessageFromShort(mtpMessage: GramJs.UpdateShortMessage): ApiMessage {
  const chatId = buildApiPeerId(mtpMessage.userId, 'user');

  return buildApiMessageWithChatId(chatId, {
    ...mtpMessage,
    peerId: buildPeer(mtpMessage.out ? buildApiPeerId(mtpMessage.userId, 'user') : currentUserId),
  });
}

export function buildApiMessageFromShortChat(mtpMessage: GramJs.UpdateShortChatMessage): ApiMessage {
  const chatId = buildApiPeerId(mtpMessage.chatId, 'chat');

  return buildApiMessageWithChatId(chatId, {
    ...mtpMessage,
    fromId: buildPeer(buildApiPeerId(mtpMessage.fromId, 'user')),
    peerId: buildPeer(buildApiPeerId(mtpMessage.chatId, 'chat')),
  });
}

export function buildApiMessageFromNotification(
  notification: GramJs.UpdateServiceNotification,
  currentDate: number,
): ApiMessage {
  const localId = getNextLocalMessageId(currentDate);
  const content = buildMessageContent(notification);

  return {
    id: localId,
    chatId: SERVICE_NOTIFICATIONS_USER_ID,
    date: notification.inboxDate || currentDate,
    content,
    isInvertedMedia: notification.invertMedia,
    isOutgoing: false,
  };
}

type TypeMessageWithContent = OmitVirtualFields<GramJs.Message> & OmitVirtualFields<GramJs.MessageService>;
export type UniversalMessage = (
  Pick<TypeMessageWithContent, ('id' | 'date' | 'peerId')>
  & Partial<TypeMessageWithContent>
);

export function buildApiMessageWithChatId(
  chatId: string,
  mtpMessage: UniversalMessage,
): ApiMessage {
  const isPrivateChat = getEntityTypeById(chatId) === 'user';
  // Server can return `fromId` for our own messages in private chats, but not for incoming ones
  // This can break grouping logic, as we do not fill `fromId` for `UpdateShortMessage` case
  const fromId = mtpMessage.fromId && !isPrivateChat
    ? getApiChatIdFromMtpPeer(mtpMessage.fromId) : undefined;

  const isChatWithSelf = !fromId && chatId === currentUserId;
  const forwardInfo = mtpMessage.fwdFrom && buildApiMessageForwardInfo(mtpMessage.fwdFrom, isChatWithSelf);

  const isSavedOutgoing = Boolean(!forwardInfo || forwardInfo.fromId === currentUserId || forwardInfo.isSavedOutgoing);

  const isOutgoing = !isChatWithSelf ? Boolean(mtpMessage.out && !mtpMessage.post)
    : isSavedOutgoing;
  const content = buildMessageContent(mtpMessage);
  const action = mtpMessage.action && buildApiMessageAction(mtpMessage.action);
  if (action) {
    content.action = action;
  }
  const isScheduled = mtpMessage.date > getServerTime() + MIN_SCHEDULED_PERIOD;

  const isInvoiceMedia = mtpMessage.media instanceof GramJs.MessageMediaInvoice
    && Boolean(mtpMessage.media.extendedMedia);

  const isEdited = Boolean(mtpMessage.editDate) && !mtpMessage.editHide;
  const {
    inlineButtons, keyboardButtons, keyboardPlaceholder, isKeyboardSingleUse, isKeyboardSelective,
  } = buildReplyButtons(
    mtpMessage.replyMarkup,
    mtpMessage.media instanceof GramJs.MessageMediaInvoice ? mtpMessage.media.receiptMsgId : undefined,
  ) || {};
  const { mediaUnread: isMediaUnread, postAuthor } = mtpMessage;
  const groupedId = mtpMessage.groupedId !== undefined ? String(mtpMessage.groupedId) : undefined;
  const isInAlbum = Boolean(groupedId) && !(content.document || content.audio || content.sticker);
  const shouldHideKeyboardButtons = mtpMessage.replyMarkup instanceof GramJs.ReplyKeyboardHide;
  const isHideKeyboardSelective = mtpMessage.replyMarkup instanceof GramJs.ReplyKeyboardHide
    && mtpMessage.replyMarkup.selective;
  const isProtected = mtpMessage.noforwards || isInvoiceMedia;
  const isForwardingAllowed = !mtpMessage.noforwards;
  const emojiOnlyCount = getEmojiOnlyCountForMessage(content, groupedId);
  if (content.text && emojiOnlyCount) content.text.emojiOnlyCount = emojiOnlyCount;

  const hasComments = mtpMessage.replies?.comments;
  const senderBoosts = mtpMessage.fromBoostsApplied;
  const factCheck = mtpMessage.factcheck && buildApiFactCheck(mtpMessage.factcheck);
  const isVideoProcessingPending = mtpMessage.videoProcessingPending;
  const areReactionsPossible = mtpMessage.reactionsArePossible;

  const isInvertedMedia = mtpMessage.invertMedia;

  const savedPeerId = mtpMessage.savedPeerId && getApiChatIdFromMtpPeer(mtpMessage.savedPeerId);

  const restrictionReasons = buildApiRestrictionReasons(mtpMessage.restrictionReason);

  return {
    id: mtpMessage.id,
    chatId,
    isOutgoing,
    content,
    date: mtpMessage.date,
    senderId: fromId,
    viewsCount: mtpMessage.views,
    forwardsCount: mtpMessage.forwards,
    isScheduled,
    isFromScheduled: mtpMessage.fromScheduled,
    isSilent: mtpMessage.silent,
    isPinned: mtpMessage.pinned,
    reactions: mtpMessage.reactions && buildMessageReactions(mtpMessage.reactions),
    ...(mtpMessage.replyTo && { replyInfo: buildApiReplyInfo(mtpMessage.replyTo, mtpMessage) }),
    ...(mtpMessage.suggestedPost && { suggestedPostInfo: buildApiSuggestedPost(mtpMessage.suggestedPost) }),
    forwardInfo,
    isEdited,
    editDate: mtpMessage.editDate,
    isMediaUnread,
    hasUnreadMention: mtpMessage.mentioned && isMediaUnread,
    areReactionsPossible,
    isMentioned: mtpMessage.mentioned,
    ...(groupedId && {
      groupedId,
      isInAlbum,
    }),
    inlineButtons,
    ...(keyboardButtons && {
      keyboardButtons, keyboardPlaceholder, isKeyboardSingleUse, isKeyboardSelective,
    }),
    ...(shouldHideKeyboardButtons && { shouldHideKeyboardButtons, isHideKeyboardSelective }),
    ...(mtpMessage.viaBotId && { viaBotId: buildApiPeerId(mtpMessage.viaBotId, 'user') }),
    postAuthorTitle: postAuthor,
    isProtected,
    isForwardingAllowed,
    hasComments,
    savedPeerId,
    senderBoosts,
    viaBusinessBotId: mtpMessage.viaBusinessBotId?.toString(),
    factCheck,
    effectId: mtpMessage.effect?.toString(),
    isInvertedMedia,
    isVideoProcessingPending,
    reportDeliveryUntilDate: mtpMessage.reportDeliveryUntilDate,
    paidMessageStars: toJSNumber(mtpMessage.paidMessageStars),
    restrictionReasons,
  };
}

export function buildMessageDraft(draft: GramJs.TypeDraftMessage): ApiDraft | undefined {
  if (draft instanceof GramJs.DraftMessageEmpty) {
    return undefined;
  }

  const {
    message, entities, replyTo, date, effect, suggestedPost,
  } = draft;

  const replyInfo = replyTo instanceof GramJs.InputReplyToMessage ? {
    type: 'message',
    replyToMsgId: replyTo.replyToMsgId,
    replyToTopId: replyTo.topMsgId,
    replyToPeerId: replyTo.replyToPeerId && getApiChatIdFromMtpPeer(replyTo.replyToPeerId),
    monoforumPeerId: replyTo.monoforumPeerId && getApiChatIdFromMtpPeer(replyTo.monoforumPeerId),
    quoteText: replyTo.quoteText ? buildMessageTextContent(replyTo.quoteText, replyTo.quoteEntities) : undefined,
    quoteOffset: replyTo.quoteOffset,
  } satisfies ApiInputMessageReplyInfo : undefined;

  const suggestedPostInfo = suggestedPost instanceof GramJs.SuggestedPost ? {
    isAccepted: suggestedPost.accepted,
    isRejected: suggestedPost.rejected,
    price: suggestedPost.price ? buildApiCurrencyAmount(suggestedPost.price) : undefined,
    scheduleDate: suggestedPost.scheduleDate,
  } satisfies ApiInputSuggestedPostInfo : undefined;

  return {
    text: message ? buildMessageTextContent(message, entities) : undefined,
    replyInfo,
    suggestedPostInfo,
    date,
    effectId: effect?.toString(),
  };
}

function buildApiSuggestedPost(suggestedPost: GramJs.SuggestedPost): ApiSuggestedPost {
  return {
    isAccepted: suggestedPost.accepted,
    isRejected: suggestedPost.rejected,
    price: suggestedPost.price ? buildApiCurrencyAmount(suggestedPost.price) : undefined,
    scheduleDate: suggestedPost.scheduleDate,
  };
}

function buildApiMessageForwardInfo(fwdFrom: GramJs.MessageFwdHeader, isChatWithSelf = false): ApiMessageForwardInfo {
  const savedFromPeerId = fwdFrom.savedFromPeer && getApiChatIdFromMtpPeer(fwdFrom.savedFromPeer);
  const fromId = fwdFrom.fromId && getApiChatIdFromMtpPeer(fwdFrom.fromId);

  return {
    date: fwdFrom.date,
    savedDate: fwdFrom.savedDate,
    isImported: fwdFrom.imported,
    isChannelPost: Boolean(fwdFrom.channelPost),
    channelPostId: fwdFrom.channelPost,
    isLinkedChannelPost: Boolean(fwdFrom.channelPost && savedFromPeerId === fromId
      && fwdFrom.savedFromMsgId === fwdFrom.channelPost && !isChatWithSelf),
    savedFromPeerId,
    isSavedOutgoing: fwdFrom.savedOut,
    fromId,
    fromChatId: fromId || savedFromPeerId,
    fromMessageId: fwdFrom.savedFromMsgId || fwdFrom.channelPost,
    hiddenUserName: fwdFrom.fromName,
    postAuthorTitle: fwdFrom.postAuthor,
  };
}

function buildApiReplyInfo(
  replyHeader: GramJs.TypeMessageReplyHeader, context?: MediaRepairContext,
): ApiReplyInfo | undefined {
  if (replyHeader instanceof GramJs.MessageReplyStoryHeader) {
    return {
      type: 'story',
      peerId: getApiChatIdFromMtpPeer(replyHeader.peer),
      storyId: replyHeader.storyId,
    };
  }

  if (replyHeader instanceof GramJs.MessageReplyHeader) {
    const {
      replyFrom,
      replyToMsgId,
      replyToTopId,
      replyMedia,
      replyToPeerId,
      forumTopic,
      quote,
      quoteText,
      quoteEntities,
      quoteOffset,
    } = replyHeader;

    return {
      type: 'message',
      replyToMsgId,
      replyToTopId,
      isForumTopic: forumTopic,
      replyFrom: replyFrom && buildApiMessageForwardInfo(replyFrom),
      replyToPeerId: replyToPeerId && getApiChatIdFromMtpPeer(replyToPeerId),
      replyMedia: replyMedia && buildMessageMediaContent(replyMedia, context),
      isQuote: quote,
      quoteText: quoteText ? buildMessageTextContent(quoteText, quoteEntities) : undefined,
      quoteOffset,
    };
  }

  return undefined;
}

export function buildApiFactCheck(factCheck: GramJs.FactCheck): ApiFactCheck {
  return {
    shouldFetch: factCheck.needCheck,
    hash: factCheck.hash.toString(),
    text: factCheck.text && buildApiFormattedText(factCheck.text),
    countryCode: factCheck.country,
  };
}

function buildNewPoll(poll: ApiNewPoll, localId: number): ApiPoll {
  return {
    mediaType: 'poll',
    id: String(localId),
    summary: pick(poll.summary, ['question', 'answers']),
    results: {},
  };
}

function buildNewTodo(todo: ApiNewMediaTodo): ApiMediaTodo {
  return {
    mediaType: 'todo',
    todo: todo.todo,
  };
}

export function buildLocalMessage(
  chat: ApiChat,
  lastMessageId?: number,
  text?: string,
  entities?: ApiMessageEntity[],
  replyInfo?: ApiInputReplyInfo,
  suggestedPostInfo?: ApiInputSuggestedPostInfo,
  attachment?: ApiAttachment,
  sticker?: ApiSticker,
  gif?: ApiVideo,
  poll?: ApiNewPoll,
  todo?: ApiNewMediaTodo,
  contact?: ApiContact,
  groupedId?: string,
  scheduledAt?: number,
  sendAs?: ApiPeer,
  story?: ApiStory | ApiStorySkipped,
  isInvertedMedia?: true,
  effectId?: string,
  isPending?: true,
  messagePriceInStars?: number,
) {
  const localId = getNextLocalMessageId(lastMessageId);
  const media = attachment && buildUploadingMedia(attachment);
  const isChannel = chat.type === 'chatTypeChannel';

  const resultReplyInfo = replyInfo && buildReplyInfo(replyInfo, chat.isForum);

  const localPoll = poll && buildNewPoll(poll, localId);
  const localTodo = todo && buildNewTodo(todo);

  const formattedText = text ? addTimestampEntities(
    { text, entities, emojiOnlyCount: undefined },
  ) : undefined;

  const message = {
    id: localId,
    chatId: chat.id,
    content: omitUndefined({
      text: formattedText,
      ...media,
      sticker,
      video: gif || media?.video,
      contact,
      storyData: story && { mediaType: 'storyData', ...story },
      pollId: localPoll?.id,
      todo: localTodo,
    }),
    date: scheduledAt || Math.round(Date.now() / 1000) + getServerTimeOffset(),
    isOutgoing: !isChannel,
    senderId: chat.type !== 'chatTypePrivate' ? (sendAs?.id || currentUserId) : undefined,
    replyInfo: resultReplyInfo,
    suggestedPostInfo,
    ...(groupedId && {
      groupedId,
      ...(media && (media.photo || media.video) && { isInAlbum: true }),
    }),
    ...(scheduledAt && { isScheduled: true }),
    isForwardingAllowed: true,
    isInvertedMedia,
    effectId,
    ...(isPending && { sendingState: 'messageSendingStatePending' }),
    ...(messagePriceInStars && { paidMessageStars: messagePriceInStars }),
  } satisfies ApiMessage;

  const emojiOnlyCount = getEmojiOnlyCountForMessage(message.content, message.groupedId);
  if (emojiOnlyCount && message.content.text) message.content.text.emojiOnlyCount = emojiOnlyCount;

  return {
    message,
    poll: localPoll,
  };
}

export function buildLocalForwardedMessage({
  toChat,
  toThreadId,
  message,
  scheduledAt,
  noAuthors,
  noCaptions,
  isCurrentUserPremium,
  lastMessageId,
  sendAs,
}: {
  toChat: ApiChat;
  toThreadId?: number;
  message: ApiMessage;
  scheduledAt?: number;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
  lastMessageId?: number;
  sendAs?: ApiPeer;
}): ApiMessage {
  const localId = getNextLocalMessageId(lastMessageId);
  const {
    content,
    chatId: fromChatId,
    id: fromMessageId,
    senderId,
    groupedId,
    isInAlbum,
    isInvertedMedia,
  } = message;

  const isAudio = content.audio;
  const asIncomingInChatWithSelf = (
    toChat.id === currentUserId && (fromChatId !== toChat.id || message.forwardInfo) && !isAudio
  );
  const shouldHideText = Object.keys(content).length > 1 && content.text && noCaptions;
  const shouldDropCustomEmoji = !isCurrentUserPremium;
  const strippedText = content.text?.entities && shouldDropCustomEmoji ? {
    text: content.text.text,
    entities: content.text.entities.filter((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji),
  } : content.text;
  const textWithTimestamps = strippedText && addTimestampEntities(strippedText);
  const emojiOnlyCount = getEmojiOnlyCountForMessage(content, groupedId);
  if (emojiOnlyCount && textWithTimestamps) textWithTimestamps.emojiOnlyCount = emojiOnlyCount;

  const updatedContent = {
    ...content,
    text: !shouldHideText ? textWithTimestamps : undefined,
  };

  // TODO Prepare reply info between forwarded messages locally, to prevent height jumps
  const isToMainThread = toThreadId === MAIN_THREAD_ID;
  const replyInfo: ApiReplyInfo | undefined = toThreadId && !isToMainThread ? {
    type: 'message',
    replyToMsgId: toThreadId,
    replyToTopId: toThreadId,
    isForumTopic: toChat.isForum || undefined,
  } : undefined;

  return {
    id: localId,
    chatId: toChat.id,
    content: updatedContent,
    date: scheduledAt || Math.round(Date.now() / 1000) + getServerTimeOffset(),
    isOutgoing: !asIncomingInChatWithSelf && toChat.type !== 'chatTypeChannel',
    senderId: toChat.type !== 'chatTypePrivate' ? (sendAs?.id || currentUserId) : undefined,
    sendingState: 'messageSendingStatePending',
    groupedId,
    isInAlbum,
    isForwardingAllowed: true,
    replyInfo,
    isInvertedMedia,
    ...(toThreadId && toChat?.isForum && { isTopicReply: true }),

    // Forward info doesn't get added when user forwards own messages and when forwarding audio
    ...(message.chatId !== currentUserId && !isAudio && !noAuthors && {
      forwardInfo: {
        date: message.forwardInfo?.date || message.date,
        savedDate: message.date,
        isChannelPost: false,
        fromChatId,
        fromMessageId,
        fromId: senderId,
        savedFromPeerId: message.chatId,
      },
    }),
    ...(message.chatId === currentUserId && !noAuthors && { forwardInfo: message.forwardInfo }),
    ...(scheduledAt && { isScheduled: true }),
  };
}

function buildReplyInfo(inputInfo: ApiInputReplyInfo, isForum?: boolean): ApiReplyInfo {
  if (inputInfo.type === 'story') {
    return {
      type: 'story',
      peerId: inputInfo.peerId,
      storyId: inputInfo.storyId,
    };
  }

  return {
    type: 'message',
    replyToMsgId: inputInfo.replyToMsgId,
    replyToTopId: inputInfo.replyToTopId,
    replyToPeerId: inputInfo.replyToPeerId,
    quoteText: inputInfo.quoteText,
    quoteOffset: inputInfo.quoteOffset,
    isForumTopic: isForum && inputInfo.replyToTopId ? true : undefined,
    ...(Boolean(inputInfo.quoteText) && { isQuote: true }),
  };
}

export function buildUploadingMedia(
  attachment: ApiAttachment,
): MediaContent {
  const {
    filename: fileName,
    blobUrl,
    previewBlobUrl,
    mimeType,
    size,
    audio,
    shouldSendAsFile,
    shouldSendAsSpoiler,
    ttlSeconds,
  } = attachment;

  if (!shouldSendAsFile) {
    if (attachment.quick) {
      // TODO Handle GIF as video, but support playback in <video>
      if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
        const { width, height } = attachment.quick;
        return {
          photo: {
            mediaType: 'photo',
            id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
            sizes: [],
            thumbnail: { width, height, dataUri: previewBlobUrl || blobUrl },
            blobUrl,
            date: Math.round(Date.now() / 1000),
            isSpoiler: shouldSendAsSpoiler,
          },
        };
      }
      if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
        const { width, height, duration } = attachment.quick;
        return {
          video: {
            mediaType: 'video',
            id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
            mimeType,
            duration: duration || 0,
            fileName,
            width,
            height,
            blobUrl,
            ...(previewBlobUrl && { thumbnail: { width, height, dataUri: previewBlobUrl } }),
            size,
            isSpoiler: shouldSendAsSpoiler,
          },
        };
      }
    }
    if (attachment.voice) {
      const { duration, waveform } = attachment.voice;
      const { data: inputWaveform } = interpolateArray(waveform, INPUT_WAVEFORM_LENGTH);
      return {
        voice: {
          mediaType: 'voice',
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          duration,
          waveform: inputWaveform,
          size,
        },
        ttlSeconds,
      };
    }
    if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) {
      const { duration, performer, title } = audio || {};
      return {
        audio: {
          mediaType: 'audio',
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          mimeType,
          fileName,
          size,
          duration: duration || 0,
          title,
          performer,
        },
      };
    }
  }
  return {
    document: {
      mediaType: 'document',
      mimeType,
      fileName,
      size,
      ...(previewBlobUrl && { previewBlobUrl }),
    },
  };
}

export function buildApiThreadInfoFromMessage(
  mtpMessage: GramJs.TypeMessage,
): ApiThreadInfo | undefined {
  const chatId = resolveMessageApiChatId(mtpMessage);
  if (
    !chatId
    || !(mtpMessage instanceof GramJs.Message)
    || !mtpMessage.replies) {
    return undefined;
  }

  return buildApiThreadInfo(mtpMessage.replies, mtpMessage.id, chatId);
}

export function buildApiThreadInfo(
  messageReplies: GramJs.TypeMessageReplies, messageId: number, chatId: string,
): ApiThreadInfo | undefined {
  const {
    channelId, replies, maxId, readMaxId, recentRepliers, comments,
  } = messageReplies;

  const apiChannelId = channelId ? buildApiPeerId(channelId, 'channel') : undefined;
  if (apiChannelId === DELETED_COMMENTS_CHANNEL_ID) {
    return undefined;
  }

  const baseThreadInfo = {
    messagesCount: replies,
    ...(maxId && { lastMessageId: maxId }),
    ...(readMaxId && { lastReadMessageId: readMaxId }),
    ...(recentRepliers && { recentReplierIds: recentRepliers.map(getApiChatIdFromMtpPeer) }),
  };

  if (comments) {
    return {
      ...baseThreadInfo,
      isCommentsInfo: true,
      chatId: apiChannelId!,
      originChannelId: chatId,
      originMessageId: messageId,
    };
  }

  return {
    ...baseThreadInfo,
    isCommentsInfo: false,
    chatId,
    threadId: messageId,
  };
}

export function buildApiQuickReply(reply: GramJs.TypeQuickReply): ApiQuickReply {
  const { shortcutId, shortcut, topMessage } = reply;
  return {
    id: shortcutId,
    shortcut,
    topMessageId: topMessage,
  };
}

export function buildApiReportResult(
  result: GramJs.TypeReportResult,
): ApiMessageReportResult {
  if (result instanceof GramJs.ReportResultReported) {
    return {
      type: 'reported',
    };
  }

  if (result instanceof GramJs.ReportResultAddComment) {
    return {
      type: 'comment',
      isOptional: result.optional,
      option: serializeBytes(result.option),
    };
  }

  const title = result.title;
  const options = result.options.map((option) => ({
    text: option.text,
    option: serializeBytes(option.option),
  }));

  return {
    type: 'selectOption',
    title,
    options,
  };
}

function processInlineBotResult(queryId: string, result: GramJs.TypeBotInlineResult) {
  if (result instanceof GramJs.BotInlineMediaResult) {
    if (result.document instanceof GramJs.Document) {
      addDocumentToLocalDb(result.document);
    }

    if (result.photo instanceof GramJs.Photo) {
      addPhotoToLocalDb(result.photo);
    }

    return buildApiBotInlineMediaResult(result, queryId);
  }

  if (result.thumb) {
    addWebDocumentToLocalDb(result.thumb);
  }

  return buildApiBotInlineResult(result, queryId);
}

export function buildPreparedInlineMessage(
  result: GramJs.messages.TypePreparedInlineMessage,
): ApiPreparedInlineMessage {
  const queryId = result.queryId.toString();

  return {
    queryId,
    result: processInlineBotResult(queryId, result.result),
    peerTypes: result.peerTypes?.map(buildApiInlineQueryPeerType),
    cacheTime: result.cacheTime,
  };
}

export function buildApiSearchPostsFlood(
  searchFlood: GramJs.SearchPostsFlood,
  query?: string,
): ApiSearchPostsFlood {
  return {
    query,
    queryIsFree: searchFlood.queryIsFree,
    totalDaily: searchFlood.totalDaily,
    remains: searchFlood.remains,
    waitTill: searchFlood.waitTill,
    starsAmount: toJSNumber(searchFlood.starsAmount),
  };
}
