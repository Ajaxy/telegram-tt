import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiDraft } from '../../../global/types';
import type {
  ApiAction,
  ApiAttachment,
  ApiChat,
  ApiContact,
  ApiFactCheck,
  ApiFormattedText,
  ApiGroupCall,
  ApiInputMessageReplyInfo,
  ApiInputReplyInfo,
  ApiKeyboardButton,
  ApiMessage,
  ApiMessageActionStarGift,
  ApiMessageEntity,
  ApiMessageForwardInfo,
  ApiMessageReportResult,
  ApiNewPoll,
  ApiPeer,
  ApiPhoto,
  ApiPoll,
  ApiQuickReply,
  ApiReplyInfo,
  ApiReplyKeyboard,
  ApiSponsoredMessage,
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
  STARS_CURRENCY_CODE,
  SUPPORTED_AUDIO_CONTENT_TYPES,
  SUPPORTED_PHOTO_CONTENT_TYPES,
  SUPPORTED_VIDEO_CONTENT_TYPES,
} from '../../../config';
import { getEmojiOnlyCountForMessage } from '../../../global/helpers/getEmojiOnlyCountForMessage';
import { omitUndefined, pick } from '../../../util/iteratees';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { interpolateArray } from '../../../util/waveform';
import { buildPeer } from '../gramjsBuilders';
import {
  addPhotoToLocalDb,
  type MediaRepairContext,
  resolveMessageApiChatId,
  serializeBytes,
} from '../helpers';
import { buildApiCallDiscardReason } from './calls';
import {
  buildApiFormattedText,
  buildApiPhoto,
} from './common';
import { buildMessageContent, buildMessageMediaContent, buildMessageTextContent } from './messageContent';
import { buildApiStarGift } from './payments';
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
    fromId: buildPeer(mtpMessage.out ? currentUserId : buildApiPeerId(mtpMessage.userId, 'user')),
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
    isOutgoing: false,
  };
}

export type UniversalMessage = (
  Pick<GramJs.Message & GramJs.MessageService, ('id' | 'date' | 'peerId')>
  & Partial<GramJs.Message & GramJs.MessageService>
);

export function buildApiMessageWithChatId(
  chatId: string,
  mtpMessage: UniversalMessage,
): ApiMessage {
  const fromId = mtpMessage.fromId ? getApiChatIdFromMtpPeer(mtpMessage.fromId) : undefined;
  const peerId = mtpMessage.peerId ? getApiChatIdFromMtpPeer(mtpMessage.peerId) : undefined;

  const isChatWithSelf = !fromId && chatId === currentUserId;
  const forwardInfo = mtpMessage.fwdFrom && buildApiMessageForwardInfo(mtpMessage.fwdFrom, isChatWithSelf);

  const isSavedOutgoing = Boolean(!forwardInfo || forwardInfo.fromId === currentUserId || forwardInfo.isSavedOutgoing);

  const isOutgoing = !isChatWithSelf ? Boolean(mtpMessage.out && !mtpMessage.post)
    : isSavedOutgoing;
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
  const senderBoosts = mtpMessage.fromBoostsApplied;
  const factCheck = mtpMessage.factcheck && buildApiFactCheck(mtpMessage.factcheck);
  const isVideoProcessingPending = mtpMessage.videoProcessingPending;

  const isInvertedMedia = mtpMessage.invertMedia;

  const savedPeerId = mtpMessage.savedPeerId && getApiChatIdFromMtpPeer(mtpMessage.savedPeerId);

  return omitUndefined<ApiMessage>({
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
    emojiOnlyCount,
    ...(mtpMessage.replyTo && { replyInfo: buildApiReplyInfo(mtpMessage.replyTo, mtpMessage) }),
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
    savedPeerId,
    senderBoosts,
    viaBusinessBotId: mtpMessage.viaBusinessBotId?.toString(),
    factCheck,
    effectId: mtpMessage.effect?.toString(),
    isInvertedMedia,
    isVideoProcessingPending,
  });
}

export function buildMessageDraft(draft: GramJs.TypeDraftMessage): ApiDraft | undefined {
  if (draft instanceof GramJs.DraftMessageEmpty) {
    return undefined;
  }

  const {
    message, entities, replyTo, date, effect,
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
    effectId: effect?.toString(),
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

function buildApiMessageActionStarGift(action: GramJs.MessageActionStarGift) : ApiMessageActionStarGift {
  const {
    nameHidden, saved, converted, gift, message, convertStars,
  } = action;

  return {
    isNameHidden: Boolean(nameHidden),
    isSaved: Boolean(saved),
    isConverted: Boolean(converted),
    gift: buildApiStarGift(gift),
    message: message && buildApiFormattedText(message),
    starsToConvert: convertStars?.toJSNumber(),
  };
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
  let stars: number | undefined;
  let starGift: ApiMessageActionStarGift | undefined;
  let currency: string | undefined;
  let giftCryptoInfo: {
    currency: string;
    amount: number;
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
  let transactionId: string | undefined;
  let message: ApiFormattedText | undefined;

  let targetUserIds = 'users' in action
    ? action.users && action.users.map((id) => buildApiPeerId(id, 'user'))
    : ('userId' in action && [buildApiPeerId(action.userId, 'user')]) || [];

  let targetChatId;
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
    type = 'receipt';
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
    type = 'giftPremium';
    text = isOutgoing ? 'ActionGiftOutbound' : 'ActionGiftInbound';
    if (isOutgoing) {
      translationValues.push('%gift_payment_amount%');
    } else {
      translationValues.push('%action_origin%', '%gift_payment_amount%');
    }
    if (action.message) {
      message = buildApiFormattedText(action.message);
    }
    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
    }
    currency = action.currency;
    if (action.cryptoCurrency) {
      giftCryptoInfo = {
        currency: action.cryptoCurrency,
        amount: action.cryptoAmount!.toJSNumber(),
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
    type = 'giftCode';
    text = isOutgoing ? 'ActionGiftOutbound' : 'BoostingReceivedGiftNoName';
    slug = action.slug;
    months = action.months;
    amount = action.amount?.toJSNumber();
    isGiveaway = Boolean(action.viaGiveaway);
    isUnclaimed = Boolean(action.unclaimed);
    if (isOutgoing) {
      translationValues.push('%gift_payment_amount%');
    }
    if (action.message) {
      message = buildApiFormattedText(action.message);
    }

    currency = action.currency;
    if (action.cryptoCurrency) {
      giftCryptoInfo = {
        currency: action.cryptoCurrency,
        amount: action.cryptoAmount!.toJSNumber(),
      };
    }
    if (action.boostPeer) {
      targetChatId = getApiChatIdFromMtpPeer(action.boostPeer);
    }
    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
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
  } else if (action instanceof GramJs.MessageActionPrizeStars) {
    type = 'prizeStars';
    isUnclaimed = Boolean(action.unclaimed);
    if (action.boostPeer) {
      targetChatId = getApiChatIdFromMtpPeer(action.boostPeer);
    }
    text = 'Notification.StarsPrize';
    stars = action.stars.toJSNumber();
    transactionId = action.transactionId;
  } else if (action instanceof GramJs.MessageActionBoostApply) {
    type = 'chatBoost';
    if (action.boosts === 1) {
      text = senderId === currentUserId ? 'BoostingBoostsGroupByYouServiceMsg' : 'BoostingBoostsGroupByUserServiceMsg';
      translationValues.push('%action_origin%');
    } else {
      text = senderId === currentUserId ? 'BoostingBoostsGroupByYouServiceMsgCount'
        : 'BoostingBoostsGroupByUserServiceMsgCount';
      translationValues.push(action.boosts.toString());
      if (senderId !== currentUserId) {
        translationValues.unshift('%action_origin%');
      }
      pluralValue = action.boosts;
    }
  } else if (action instanceof GramJs.MessageActionPaymentRefunded) {
    text = 'ActionRefunded';
    amount = Number(action.totalAmount);
    currency = action.currency;
  } else if (action instanceof GramJs.MessageActionRequestedPeer) {
    text = 'ActionRequestedPeer';
    if (action.peers) {
      targetUserIds = action.peers?.map((peer) => getApiChatIdFromMtpPeer(peer));
    }
    if (targetPeerId) {
      translationValues.unshift('%action_origin%');
    }
  } else if (action instanceof GramJs.MessageActionGiftStars) {
    type = 'giftStars';
    text = isOutgoing ? 'ActionGiftOutbound' : targetPeerId ? 'ActionGiftInbound' : 'BoostingReceivedGiftNoName';
    if (isOutgoing) {
      translationValues.push('%gift_payment_amount%');
    } else {
      translationValues.push('%action_origin%', '%gift_payment_amount%');
    }
    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
      targetChatId = targetPeerId;
    }

    if (action.cryptoCurrency) {
      giftCryptoInfo = {
        currency: action.cryptoCurrency,
        amount: action.cryptoAmount!.toJSNumber(),
      };
    }

    currency = action.currency;
    amount = action.amount.toJSNumber();
    stars = action.stars.toJSNumber();
    transactionId = action.transactionId;
  } else if (action instanceof GramJs.MessageActionStarGift) {
    type = 'starGift';
    if (isOutgoing) {
      text = 'ActionGiftOutbound';
      translationValues.push('%gift_payment_amount%');
    } else {
      text = 'ActionGiftInbound';
      translationValues.push('%action_origin%', '%gift_payment_amount%');
    }

    if (targetPeerId) {
      targetUserIds.push(targetPeerId);
      targetChatId = targetPeerId;
    }

    amount = action.gift.stars.toJSNumber();
    currency = STARS_CURRENCY_CODE;
    starGift = buildApiMessageActionStarGift(action);
  } else {
    text = 'ChatList.UnsupportedMessage';
  }

  if ('photo' in action && action.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(action.photo);
    photo = buildApiPhoto(action.photo);
  }

  return {
    mediaType: 'action',
    text,
    type,
    targetUserIds,
    targetChatId,
    photo, // TODO Only used internally now, will be used for the UI in future
    amount,
    stars,
    starGift,
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
    transactionId,
    message,
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

      if (button instanceof GramJs.KeyboardButtonCopy) {
        return {
          type: 'copy',
          text,
          copyText: button.copyText,
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

function buildNewPoll(poll: ApiNewPoll, localId: number): ApiPoll {
  return {
    mediaType: 'poll',
    id: String(localId),
    summary: pick(poll.summary, ['question', 'answers']),
    results: {},
  };
}

export function buildLocalMessage(
  chat: ApiChat,
  lastMessageId?: number,
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
  isInvertedMedia?: true,
  effectId?: string,
) {
  const localId = getNextLocalMessageId(lastMessageId);
  const media = attachment && buildUploadingMedia(attachment);
  const isChannel = chat.type === 'chatTypeChannel';

  const resultReplyInfo = replyInfo && buildReplyInfo(replyInfo, chat.isForum);

  const localPoll = poll && buildNewPoll(poll, localId);

  const message = {
    id: localId,
    chatId: chat.id,
    content: omitUndefined({
      text: text ? {
        text,
        entities,
      } : undefined,
      ...media,
      sticker,
      video: gif || media?.video,
      contact,
      storyData: story && { mediaType: 'storyData', ...story },
      pollId: localPoll?.id,
    }),
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
    isInvertedMedia,
    effectId,
  } satisfies ApiMessage;

  const emojiOnlyCount = getEmojiOnlyCountForMessage(message.content, message.groupedId);

  const finalMessage = {
    ...message,
    ...(emojiOnlyCount && { emojiOnlyCount }),
  };

  return {
    message: finalMessage,
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
    senderId: sendAs?.id || currentUserId,
    sendingState: 'messageSendingStatePending',
    groupedId,
    isInAlbum,
    isForwardingAllowed: true,
    replyInfo,
    isInvertedMedia,
    ...(toThreadId && toChat?.isForum && { isTopicReply: true }),

    ...(emojiOnlyCount && { emojiOnlyCount }),
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
