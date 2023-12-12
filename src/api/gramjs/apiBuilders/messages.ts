import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiDraft } from '../../../global/types';
import type {
  ApiAction,
  ApiAttachment,
  ApiChat,
  ApiContact,
  ApiGroupCall,
  ApiInputMessageReplyInfo,
  ApiInputReplyInfo,
  ApiKeyboardButton,
  ApiMessage,
  ApiMessageEntity,
  ApiMessageForwardInfo,
  ApiNewPoll,
  ApiPeer,
  ApiPhoto,
  ApiReplyInfo,
  ApiReplyKeyboard,
  ApiSponsoredMessage,
  ApiSponsoredWebPage,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiThreadInfo,
  ApiVideo,
  MediaContent,
  PhoneCallAction,
} from '../../types';
import {
  ApiMessageEntityTypes, MAIN_THREAD_ID,
} from '../../types';

import {
  DELETED_COMMENTS_CHANNEL_ID,
  SERVICE_NOTIFICATIONS_USER_ID,
  SPONSORED_MESSAGE_CACHE_MS,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_IMAGE_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getEmojiOnlyCountForMessage } from '../../../global/helpers/getEmojiOnlyCountForMessage';
import { omitUndefined, pick } from '../../../util/iteratees';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { interpolateArray } from '../../../util/waveform';
import { buildPeer } from '../gramjsBuilders';
import {
  addPhotoToLocalDb,
  resolveMessageApiChatId,
  serializeBytes,
} from '../helpers';
import { buildApiBotApp } from './bots';
import { buildApiCallDiscardReason } from './calls';
import {
  buildApiPhoto,
} from './common';
import { buildMessageContent, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiPeerId, getApiChatIdFromMtpPeer, isPeerUser } from './peers';
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

export function buildApiSponsoredMessage(mtpMessage: GramJs.SponsoredMessage): ApiSponsoredMessage | undefined {
  const {
    fromId, message, entities, startParam, channelPost, chatInvite, chatInviteHash, randomId, recommended, sponsorInfo,
    additionalInfo, showPeerPhoto, webpage, buttonText, app,
  } = mtpMessage;
  const chatId = fromId ? getApiChatIdFromMtpPeer(fromId) : undefined;
  const chatInviteTitle = chatInvite
    ? (chatInvite instanceof GramJs.ChatInvite
      ? chatInvite.title
      : !(chatInvite.chat instanceof GramJs.ChatEmpty) ? chatInvite.chat.title : undefined)
    : undefined;

  return {
    randomId: serializeBytes(randomId),
    isBot: fromId ? isPeerUser(fromId) : false,
    text: buildMessageTextContent(message, entities),
    expiresAt: Math.round(Date.now() / 1000) + SPONSORED_MESSAGE_CACHE_MS,
    isRecommended: Boolean(recommended),
    ...(webpage && { webPage: buildSponsoredWebPage(webpage) }),
    ...(showPeerPhoto && { isAvatarShown: true }),
    ...(chatId && { chatId }),
    ...(chatInviteHash && { chatInviteHash }),
    ...(chatInvite && { chatInviteTitle }),
    ...(startParam && { startParam }),
    ...(channelPost && { channelPostId: channelPost }),
    ...(sponsorInfo && { sponsorInfo }),
    ...(additionalInfo && { additionalInfo }),
    ...(buttonText && { buttonText }),
    ...(app && { botApp: buildApiBotApp(app) }),
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
    fromId: buildPeer(mtpMessage.out ? currentUserId : buildApiPeerId(mtpMessage.userId, 'user')),
  });
}

export function buildApiMessageFromShortChat(mtpMessage: GramJs.UpdateShortChatMessage): ApiMessage {
  const chatId = buildApiPeerId(mtpMessage.chatId, 'chat');

  return buildApiMessageWithChatId(chatId, {
    ...mtpMessage,
    fromId: buildPeer(buildApiPeerId(mtpMessage.fromId, 'user')),
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
    isOutgoing: false,
  };
}

export type UniversalMessage = (
  Pick<GramJs.Message & GramJs.MessageService, ('id' | 'date')>
  & Pick<Partial<GramJs.Message & GramJs.MessageService>, (
    'out' | 'message' | 'entities' | 'fromId' | 'peerId' | 'fwdFrom' | 'replyTo' | 'replyMarkup' | 'post' |
    'media' | 'action' | 'views' | 'editDate' | 'editHide' | 'mediaUnread' | 'groupedId' | 'mentioned' | 'viaBotId' |
    'replies' | 'fromScheduled' | 'postAuthor' | 'noforwards' | 'reactions' | 'forwards' | 'silent' | 'pinned'
  )>
);

export function buildApiMessageWithChatId(
  chatId: string,
  mtpMessage: UniversalMessage,
): ApiMessage {
  const fromId = mtpMessage.fromId ? getApiChatIdFromMtpPeer(mtpMessage.fromId) : undefined;
  const peerId = mtpMessage.peerId ? getApiChatIdFromMtpPeer(mtpMessage.peerId) : undefined;
  const isChatWithSelf = !fromId && chatId === currentUserId;
  const isOutgoing = (mtpMessage.out && !mtpMessage.post) || (isChatWithSelf && !mtpMessage.fwdFrom);
  const content = buildMessageContent(mtpMessage);
  const action = mtpMessage.action
    && buildAction(mtpMessage.action, fromId, peerId, Boolean(mtpMessage.post), isOutgoing);
  if (action) {
    content.action = action;
  }
  const isScheduled = mtpMessage.date > getServerTime() + MIN_SCHEDULED_PERIOD;

  const isInvoiceMedia = mtpMessage.media instanceof GramJs.MessageMediaInvoice
    && Boolean(mtpMessage.media.extendedMedia);

  const isEdited = Boolean(mtpMessage.editDate) && !mtpMessage.editHide;
  const {
    inlineButtons, keyboardButtons, keyboardPlaceholder, isKeyboardSingleUse, isKeyboardSelective,
  } = buildReplyButtons(mtpMessage, isInvoiceMedia) || {};
  const forwardInfo = mtpMessage.fwdFrom && buildApiMessageForwardInfo(mtpMessage.fwdFrom, isChatWithSelf);
  const { mediaUnread: isMediaUnread, postAuthor } = mtpMessage;
  const groupedId = mtpMessage.groupedId && String(mtpMessage.groupedId);
  const isInAlbum = Boolean(groupedId) && !(content.document || content.audio || content.sticker);
  const shouldHideKeyboardButtons = mtpMessage.replyMarkup instanceof GramJs.ReplyKeyboardHide;
  const isHideKeyboardSelective = mtpMessage.replyMarkup instanceof GramJs.ReplyKeyboardHide
    && mtpMessage.replyMarkup.selective;
  const isProtected = mtpMessage.noforwards || isInvoiceMedia;
  const isForwardingAllowed = !mtpMessage.noforwards;
  const emojiOnlyCount = getEmojiOnlyCountForMessage(content, groupedId);
  const hasComments = mtpMessage.replies?.comments;

  return omitUndefined({
    id: mtpMessage.id,
    chatId,
    isOutgoing,
    content,
    date: mtpMessage.date,
    senderId: fromId || (mtpMessage.out && mtpMessage.post && currentUserId) || chatId,
    viewsCount: mtpMessage.views,
    forwardsCount: mtpMessage.forwards,
    isScheduled,
    isFromScheduled: mtpMessage.fromScheduled,
    isSilent: mtpMessage.silent,
    isPinned: mtpMessage.pinned,
    reactions: mtpMessage.reactions && buildMessageReactions(mtpMessage.reactions),
    emojiOnlyCount,
    ...(mtpMessage.replyTo && { replyInfo: buildApiReplyInfo(mtpMessage.replyTo) }),
    forwardInfo,
    isEdited,
    editDate: mtpMessage.editDate,
    isMediaUnread,
    hasUnreadMention: mtpMessage.mentioned && isMediaUnread,
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
  } satisfies ApiMessage);
}

export function buildMessageDraft(draft: GramJs.TypeDraftMessage): ApiDraft | undefined {
  if (draft instanceof GramJs.DraftMessageEmpty) {
    return undefined;
  }

  const {
    message, entities, replyTo, date,
  } = draft;

  const replyInfo = replyTo instanceof GramJs.InputReplyToMessage ? {
    type: 'message',
    replyToMsgId: replyTo.replyToMsgId,
    replyToTopId: replyTo.topMsgId,
    replyToPeerId: replyTo.replyToPeerId && getApiChatIdFromMtpPeer(replyTo.replyToPeerId),
    quoteText: replyTo.quoteText ? buildMessageTextContent(replyTo.quoteText, replyTo.quoteEntities) : undefined,
  } satisfies ApiInputMessageReplyInfo : undefined;

  return {
    text: message ? buildMessageTextContent(message, entities) : undefined,
    replyInfo,
    date,
  };
}

function buildApiMessageForwardInfo(fwdFrom: GramJs.MessageFwdHeader, isChatWithSelf = false): ApiMessageForwardInfo {
  const savedFromPeerId = fwdFrom.savedFromPeer && getApiChatIdFromMtpPeer(fwdFrom.savedFromPeer);
  const fromId = fwdFrom.fromId && getApiChatIdFromMtpPeer(fwdFrom.fromId);

  return {
    date: fwdFrom.date,
    isImported: fwdFrom.imported,
    isChannelPost: Boolean(fwdFrom.channelPost),
    channelPostId: fwdFrom.channelPost,
    isLinkedChannelPost: Boolean(fwdFrom.channelPost && savedFromPeerId && !isChatWithSelf),
    fromChatId: savedFromPeerId || fromId,
    fromMessageId: fwdFrom.savedFromMsgId || fwdFrom.channelPost,
    senderUserId: fromId,
    hiddenUserName: fwdFrom.fromName,
    postAuthorTitle: fwdFrom.postAuthor,
  };
}

function buildApiReplyInfo(replyHeader: GramJs.TypeMessageReplyHeader): ApiReplyInfo | undefined {
  if (replyHeader instanceof GramJs.MessageReplyStoryHeader) {
    return {
      type: 'story',
      userId: replyHeader.userId.toString(),
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
    } = replyHeader;

    return {
      type: 'message',
      replyToMsgId,
      replyToTopId,
      isForumTopic: forumTopic,
      replyFrom: replyFrom && buildApiMessageForwardInfo(replyFrom),
      replyToPeerId: replyToPeerId && getApiChatIdFromMtpPeer(replyToPeerId),
      replyMedia: replyMedia && buildMessageMediaContent(replyMedia),
      isQuote: quote,
      quoteText: quoteText ? buildMessageTextContent(quoteText, quoteEntities) : undefined,
    };
  }

  return undefined;
}

function buildAction(
  action: GramJs.TypeMessageAction,
  senderId: string | undefined,
  targetPeerId: string | undefined,
  isChannelPost: boolean,
  isOutgoing: boolean,
): ApiAction | undefined {
  if (action instanceof GramJs.MessageActionEmpty) {
    return undefined;
  }

  let phoneCall: PhoneCallAction | undefined;
  let call: Partial<ApiGroupCall> | undefined;
  let amount: number | undefined;
  let currency: string | undefined;
  let giftCryptoInfo: {
    currency: string;
    amount: string;
  } | undefined;
  let text: string;
  const translationValues: string[] = [];
  let type: ApiAction['type'] = 'other';
  let photo: ApiPhoto | undefined;
  let score: number | undefined;
  let months: number | undefined;
  let topicEmojiIconId: string | undefined;
  let isTopicAction: boolean | undefined;
  let slug: string | undefined;
  let isGiveaway: boolean | undefined;
  let isUnclaimed: boolean | undefined;
  let pluralValue: number | undefined;

  const targetUserIds = 'users' in action
    ? action.users && action.users.map((id) => buildApiPeerId(id, 'user'))
    : ('userId' in action && [buildApiPeerId(action.userId, 'user')]) || [];
  let targetChatId: string | undefined;

  if (action instanceof GramJs.MessageActionChatCreate) {
    text = 'Notification.CreatedChatWithTitle';
    translationValues.push('%action_origin%', action.title);
    type = 'chatCreate';
  } else if (action instanceof GramJs.MessageActionChatEditTitle) {
    if (isChannelPost) {
      text = 'Channel.MessageTitleUpdated';
      translationValues.push(action.title);
    } else {
      text = 'Notification.ChangedGroupName';
      translationValues.push('%action_origin%', action.title);
    }
  } else if (action instanceof GramJs.MessageActionChatEditPhoto) {
    if (isChannelPost) {
      text = 'Channel.MessagePhotoUpdated';
    } else {
      text = 'Notification.ChangedGroupPhoto';
      translationValues.push('%action_origin%');
    }
  } else if (action instanceof GramJs.MessageActionChatDeletePhoto) {
    if (isChannelPost) {
      text = 'Channel.MessagePhotoRemoved';
    } else {
      text = 'Group.MessagePhotoRemoved';
    }
  } else if (action instanceof GramJs.MessageActionChatAddUser) {
    if (!senderId || targetUserIds.includes(senderId)) {
      text = 'Notification.JoinedChat';
      translationValues.push('%target_user%');
    } else {
      text = 'Notification.Invited';
      translationValues.push('%action_origin%', '%target_user%');
    }
  } else if (action instanceof GramJs.MessageActionChatDeleteUser) {
    if (!senderId || targetUserIds.includes(senderId)) {
      text = 'Notification.LeftChat';
      translationValues.push('%target_user%');
    } else {
      text = 'Notification.Kicked';
      translationValues.push('%action_origin%', '%target_user%');
    }
  } else if (action instanceof GramJs.MessageActionChatJoinedByLink) {
    text = 'Notification.JoinedGroupByLink';
    translationValues.push('%action_origin%');
  } else if (action instanceof GramJs.MessageActionChannelCreate) {
    text = 'Notification.CreatedChannel';
  } else if (action instanceof GramJs.MessageActionChatMigrateTo) {
    targetChatId = getApiChatIdFromMtpPeer(action);
    text = 'Migrated to %target_chat%';
    translationValues.push('%target_chat%');
  } else if (action instanceof GramJs.MessageActionChannelMigrateFrom) {
    targetChatId = getApiChatIdFromMtpPeer(action);
    text = 'Migrated from %target_chat%';
    translationValues.push('%target_chat%');
  } else if (action instanceof GramJs.MessageActionPinMessage) {
    text = 'Chat.Service.Group.UpdatedPinnedMessage1';
    translationValues.push('%action_origin%', '%message%');
  } else if (action instanceof GramJs.MessageActionHistoryClear) {
    text = 'HistoryCleared';
    type = 'historyClear';
  } else if (action instanceof GramJs.MessageActionPhoneCall) {
    const withDuration = Boolean(action.duration);
    text = [
      withDuration ? 'ChatList.Service' : 'Chat',
      action.video ? 'VideoCall' : 'Call',
      isOutgoing ? (withDuration ? 'outgoing' : 'Outgoing') : (withDuration ? 'incoming' : 'Incoming'),
    ].join('.');

    if (withDuration) {
      const mins = Math.max(Math.round(action.duration! / 60), 1);
      translationValues.push(`${mins} min${mins > 1 ? 's' : ''}`);
    }

    phoneCall = {
      isOutgoing,
      isVideo: action.video,
      duration: action.duration,
      reason: buildApiCallDiscardReason(action.reason),
    };
  } else if (action instanceof GramJs.MessageActionInviteToGroupCall) {
    text = 'Notification.VoiceChatInvitation';
    call = {
      id: action.call.id.toString(),
      accessHash: action.call.accessHash.toString(),
    };
    translationValues.push('%action_origin%', '%target_user%');
  } else if (action instanceof GramJs.MessageActionContactSignUp) {
    text = 'Notification.Joined';
    translationValues.push('%action_origin%');
    type = 'contactSignUp';
  } else if (action instanceof GramJs.MessageActionPaymentSent) {
    amount = Number(action.totalAmount);
    currency = action.currency;
    text = 'PaymentSuccessfullyPaid';
    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
    }
    translationValues.push('%payment_amount%', '%target_user%', '%product%');
  } else if (action instanceof GramJs.MessageActionGroupCall) {
    if (action.duration) {
      const mins = Math.max(Math.round(action.duration / 60), 1);
      text = 'Notification.VoiceChatEnded';
      translationValues.push(`${mins} min${mins > 1 ? 's' : ''}`);
    } else {
      text = 'Notification.VoiceChatStartedChannel';
      call = {
        id: action.call.id.toString(),
        accessHash: action.call.accessHash.toString(),
      };
    }
  } else if (action instanceof GramJs.MessageActionBotAllowed) {
    if (action.domain) {
      text = 'ActionBotAllowed';
      translationValues.push(action.domain);
    } else if (action.fromRequest) {
      text = 'lng_action_webapp_bot_allowed';
    } else {
      text = 'ActionAttachMenuBotAllowed';
    }
  } else if (action instanceof GramJs.MessageActionCustomAction) {
    text = action.message;
  } else if (action instanceof GramJs.MessageActionChatJoinedByRequest) {
    text = 'ChatService.UserJoinedGroupByRequest';
    translationValues.push('%action_origin%');
  } else if (action instanceof GramJs.MessageActionGameScore) {
    text = senderId === currentUserId ? 'ActionYouScoredInGame' : 'ActionUserScoredInGame';
    translationValues.push('%score%');
    score = action.score;
  } else if (action instanceof GramJs.MessageActionWebViewDataSent) {
    text = 'Notification.WebAppSentData';
    translationValues.push(action.text);
  } else if (action instanceof GramJs.MessageActionGiftPremium) {
    text = isOutgoing ? 'ActionGiftOutbound' : 'ActionGiftInbound';
    if (isOutgoing) {
      translationValues.push('%gift_payment_amount%');
    } else {
      translationValues.push('%action_origin%', '%gift_payment_amount%');
    }
    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
    }
    currency = action.currency;
    if (action.cryptoCurrency) {
      const cryptoAmountWithDecimals = action.cryptoAmount!.divide(1e7).toJSNumber() / 100;
      giftCryptoInfo = {
        currency: action.cryptoCurrency,
        amount: cryptoAmountWithDecimals.toFixed(2),
      };
    }
    amount = action.amount.toJSNumber();
    months = action.months;
  } else if (action instanceof GramJs.MessageActionTopicCreate) {
    text = 'TopicWasCreatedAction';
    type = 'topicCreate';
    translationValues.push(action.title);
  } else if (action instanceof GramJs.MessageActionTopicEdit) {
    if (action.closed !== undefined) {
      text = action.closed ? 'TopicWasClosedAction' : 'TopicWasReopenedAction';
      translationValues.push('%action_origin%', '%action_topic%');
    } else if (action.hidden !== undefined) {
      text = action.hidden ? 'TopicHidden2' : 'TopicShown';
    } else if (action.title) {
      text = 'TopicRenamedTo';
      translationValues.push('%action_origin%', action.title);
    } else if (action.iconEmojiId) {
      text = 'TopicWasIconChangedToAction';
      translationValues.push('%action_origin%', '%action_topic_icon%');
      topicEmojiIconId = action.iconEmojiId.toString();
    } else {
      text = 'ChatList.UnsupportedMessage';
    }
    isTopicAction = true;
  } else if (action instanceof GramJs.MessageActionSuggestProfilePhoto) {
    const isVideo = action.photo instanceof GramJs.Photo && action.photo.videoSizes?.length;
    text = senderId === currentUserId
      ? (isVideo ? 'ActionSuggestVideoFromYouDescription' : 'ActionSuggestPhotoFromYouDescription')
      : (isVideo ? 'ActionSuggestVideoToYouDescription' : 'ActionSuggestPhotoToYouDescription');
    type = 'suggestProfilePhoto';
    translationValues.push('%target_user%');

    if (targetPeerId) targetUserIds.push(targetPeerId);
  } else if (action instanceof GramJs.MessageActionGiveawayLaunch) {
    text = 'BoostingGiveawayJustStarted';
    translationValues.push('%action_origin%');
  } else if (action instanceof GramJs.MessageActionGiftCode) {
    text = 'BoostingReceivedGiftNoName';
    slug = action.slug;
    months = action.months;
    isGiveaway = Boolean(action.viaGiveaway);
    isUnclaimed = Boolean(action.unclaimed);
    if (action.boostPeer) {
      targetChatId = getApiChatIdFromMtpPeer(action.boostPeer);
    }
  } else if (action instanceof GramJs.MessageActionGiveawayResults) {
    if (!action.winnersCount) {
      text = 'lng_action_giveaway_results_none';
    } else if (action.unclaimedCount) {
      text = 'lng_action_giveaway_results_some';
    } else {
      text = 'BoostingGiveawayServiceWinnersSelected';
      translationValues.push('%amount%');
      amount = action.winnersCount;
      pluralValue = action.winnersCount;
    }
  } else {
    text = 'ChatList.UnsupportedMessage';
  }

  if ('photo' in action && action.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(action.photo);
    photo = buildApiPhoto(action.photo);
  }

  return {
    text,
    type,
    targetUserIds,
    targetChatId,
    photo, // TODO Only used internally now, will be used for the UI in future
    amount,
    currency,
    giftCryptoInfo,
    isGiveaway,
    slug,
    translationValues,
    call,
    phoneCall,
    score,
    months,
    topicEmojiIconId,
    isTopicAction,
    isUnclaimed,
    pluralValue,
  };
}

function buildReplyButtons(message: UniversalMessage, shouldSkipBuyButton?: boolean): ApiReplyKeyboard | undefined {
  const { replyMarkup, media } = message;

  if (!(replyMarkup instanceof GramJs.ReplyKeyboardMarkup || replyMarkup instanceof GramJs.ReplyInlineMarkup)) {
    return undefined;
  }

  const markup = replyMarkup.rows.map(({ buttons }) => {
    return buttons.map((button): ApiKeyboardButton | undefined => {
      const { text } = button;

      if (button instanceof GramJs.KeyboardButton) {
        return {
          type: 'command',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUrl) {
        if (button.url.includes('?startgroup=')) {
          return {
            type: 'unsupported',
            text,
          };
        }

        return {
          type: 'url',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonCallback) {
        if (button.requiresPassword) {
          return {
            type: 'unsupported',
            text,
          };
        }

        return {
          type: 'callback',
          text,
          data: serializeBytes(button.data),
        };
      }

      if (button instanceof GramJs.KeyboardButtonRequestPoll) {
        return {
          type: 'requestPoll',
          text,
          isQuiz: button.quiz,
        };
      }

      if (button instanceof GramJs.KeyboardButtonRequestPhone) {
        return {
          type: 'requestPhone',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonBuy) {
        if (media instanceof GramJs.MessageMediaInvoice && media.receiptMsgId) {
          return {
            type: 'receipt',
            text: 'PaymentReceipt',
            receiptMessageId: media.receiptMsgId,
          };
        }
        if (shouldSkipBuyButton) return undefined;
        return {
          type: 'buy',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonGame) {
        return {
          type: 'game',
          text,
        };
      }

      if (button instanceof GramJs.KeyboardButtonSwitchInline) {
        return {
          type: 'switchBotInline',
          text,
          query: button.query,
          isSamePeer: button.samePeer,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUserProfile) {
        return {
          type: 'userProfile',
          text,
          userId: button.userId.toString(),
        };
      }

      if (button instanceof GramJs.KeyboardButtonSimpleWebView) {
        return {
          type: 'simpleWebView',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonWebView) {
        return {
          type: 'webView',
          text,
          url: button.url,
        };
      }

      if (button instanceof GramJs.KeyboardButtonUrlAuth) {
        return {
          type: 'urlAuth',
          text,
          url: button.url,
          buttonId: button.buttonId,
        };
      }

      return {
        type: 'unsupported',
        text,
      };
    }).filter(Boolean);
  });

  if (markup.every((row) => !row.length)) return undefined;

  return {
    [replyMarkup instanceof GramJs.ReplyKeyboardMarkup ? 'keyboardButtons' : 'inlineButtons']: markup,
    ...(replyMarkup instanceof GramJs.ReplyKeyboardMarkup && {
      keyboardPlaceholder: replyMarkup.placeholder,
      isKeyboardSingleUse: replyMarkup.singleUse,
      isKeyboardSelective: replyMarkup.selective,
    }),
  };
}

function buildNewPoll(poll: ApiNewPoll, localId: number) {
  return {
    poll: {
      id: String(localId),
      summary: pick(poll.summary, ['question', 'answers']),
      results: {},
    },
  };
}

export function buildLocalMessage(
  chat: ApiChat,
  text?: string,
  entities?: ApiMessageEntity[],
  replyInfo?: ApiInputReplyInfo,
  attachment?: ApiAttachment,
  sticker?: ApiSticker,
  gif?: ApiVideo,
  poll?: ApiNewPoll,
  contact?: ApiContact,
  groupedId?: string,
  scheduledAt?: number,
  sendAs?: ApiPeer,
  story?: ApiStory | ApiStorySkipped,
): ApiMessage {
  const localId = getNextLocalMessageId(chat.lastMessage?.id);
  const media = attachment && buildUploadingMedia(attachment);
  const isChannel = chat.type === 'chatTypeChannel';

  const resultReplyInfo = replyInfo && buildReplyInfo(replyInfo, chat.isForum);

  const message = {
    id: localId,
    chatId: chat.id,
    content: {
      ...(text && {
        text: {
          text,
          entities,
        },
      }),
      ...media,
      ...(sticker && { sticker }),
      ...(gif && { video: gif }),
      ...(poll && buildNewPoll(poll, localId)),
      ...(contact && { contact }),
      ...(story && { storyData: story }),
    },
    date: scheduledAt || Math.round(Date.now() / 1000) + getServerTimeOffset(),
    isOutgoing: !isChannel,
    senderId: sendAs?.id || currentUserId,
    replyInfo: resultReplyInfo,
    ...(groupedId && {
      groupedId,
      ...(media && (media.photo || media.video) && { isInAlbum: true }),
    }),
    ...(scheduledAt && { isScheduled: true }),
    isForwardingAllowed: true,
  } satisfies ApiMessage;

  const emojiOnlyCount = getEmojiOnlyCountForMessage(message.content, message.groupedId);

  return {
    ...message,
    ...(emojiOnlyCount && { emojiOnlyCount }),
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
}: {
  toChat: ApiChat;
  toThreadId?: number;
  message: ApiMessage;
  scheduledAt?: number;
  noAuthors?: boolean;
  noCaptions?: boolean;
  isCurrentUserPremium?: boolean;
}): ApiMessage {
  const localId = getNextLocalMessageId(toChat?.lastMessage?.id);
  const {
    content,
    chatId: fromChatId,
    id: fromMessageId,
    senderId,
    groupedId,
    isInAlbum,
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
  const emojiOnlyCount = getEmojiOnlyCountForMessage(content, groupedId);

  const updatedContent = {
    ...content,
    text: !shouldHideText ? strippedText : undefined,
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
    senderId: currentUserId,
    sendingState: 'messageSendingStatePending',
    groupedId,
    isInAlbum,
    isForwardingAllowed: true,
    replyInfo,
    ...(toThreadId && toChat?.isForum && { isTopicReply: true }),

    ...(emojiOnlyCount && { emojiOnlyCount }),
    // Forward info doesn't get added when users forwards his own messages, also when forwarding audio
    ...(message.chatId !== currentUserId && !isAudio && !noAuthors && {
      forwardInfo: {
        date: message.date,
        isChannelPost: false,
        fromChatId,
        fromMessageId,
        senderUserId: senderId,
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
      userId: inputInfo.userId,
      storyId: inputInfo.storyId,
    };
  }

  return {
    type: 'message',
    replyToMsgId: inputInfo.replyToMsgId,
    replyToTopId: inputInfo.replyToTopId,
    replyToPeerId: inputInfo.replyToPeerId,
    quoteText: inputInfo.quoteText,
    isForumTopic: isForum && inputInfo.replyToTopId ? true : undefined,
    ...(Boolean(inputInfo.quoteText) && { isQuote: true }),
  };
}

function buildUploadingMedia(
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
  } = attachment;

  if (!shouldSendAsFile) {
    if (attachment.quick) {
      // TODO Handle GIF as video, but support playback in <video>
      if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType)) {
        const { width, height } = attachment.quick;
        return {
          photo: {
            id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
            sizes: [],
            thumbnail: { width, height, dataUri: previewBlobUrl || blobUrl },
            blobUrl,
            isSpoiler: shouldSendAsSpoiler,
          },
        };
      }
      if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
        const { width, height, duration } = attachment.quick;
        return {
          video: {
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
          id: LOCAL_MEDIA_UPLOADING_TEMP_ID,
          duration,
          waveform: inputWaveform,
        },
      };
    }
    if (SUPPORTED_AUDIO_CONTENT_TYPES.has(mimeType)) {
      const { duration, performer, title } = audio || {};
      return {
        audio: {
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

function buildSponsoredWebPage(webPage: GramJs.TypeSponsoredWebPage): ApiSponsoredWebPage {
  let photo: ApiPhoto | undefined;
  if (webPage.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(webPage.photo);
    photo = buildApiPhoto(webPage.photo);
  }

  return {
    ...pick(webPage, [
      'url',
      'siteName',
    ]),
    photo,
  };
}
