import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiPhoneCallDiscardReason } from '../../types';
import type { ApiMessageAction } from '../../types/messageActions';

import { buildApiBotApp } from './bots';
import { buildApiFormattedText, buildApiPhoto } from './common';
import { buildApiStarGift } from './gifts';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';

const UNSUPPORTED_ACTION: ApiMessageAction = {
  mediaType: 'action',
  type: 'unsupported',
};

export function buildApiMessageAction(action: GramJs.TypeMessageAction): ApiMessageAction {
  if (action instanceof GramJs.MessageActionChatCreate) {
    const { title, users } = action;
    return {
      mediaType: 'action',
      type: 'chatCreate',
      title,
      userIds: users.map((u) => buildApiPeerId(u, 'user')),
    };
  }
  if (action instanceof GramJs.MessageActionChatEditTitle) {
    const { title } = action;
    return {
      mediaType: 'action',
      type: 'chatEditTitle',
      title,
    };
  }
  if (action instanceof GramJs.MessageActionChatEditPhoto) {
    const { photo } = action;

    return {
      mediaType: 'action',
      type: 'chatEditPhoto',
      photo: photo instanceof GramJs.Photo ? buildApiPhoto(photo) : undefined,
    };
  }
  if (action instanceof GramJs.MessageActionChatDeletePhoto) {
    return {
      mediaType: 'action',
      type: 'chatDeletePhoto',
    };
  }
  if (action instanceof GramJs.MessageActionChatAddUser) {
    const { users } = action;
    return {
      mediaType: 'action',
      type: 'chatAddUser',
      userIds: users.map((u) => buildApiPeerId(u, 'user')),
    };
  }
  if (action instanceof GramJs.MessageActionChatDeleteUser) {
    const { userId } = action;
    return {
      mediaType: 'action',
      type: 'chatDeleteUser',
      userId: buildApiPeerId(userId, 'user'),
    };
  }
  if (action instanceof GramJs.MessageActionChatJoinedByLink) {
    const { inviterId } = action;
    return {
      mediaType: 'action',
      type: 'chatJoinedByLink',
      inviterId: buildApiPeerId(inviterId, 'user'),
    };
  }
  if (action instanceof GramJs.MessageActionChannelCreate) {
    const { title } = action;
    return {
      mediaType: 'action',
      type: 'channelCreate',
      title,
    };
  }
  if (action instanceof GramJs.MessageActionChatMigrateTo) {
    const { channelId } = action;
    return {
      mediaType: 'action',
      type: 'chatMigrateTo',
      channelId: buildApiPeerId(channelId, 'channel'),
    };
  }
  if (action instanceof GramJs.MessageActionChannelMigrateFrom) {
    const { title, chatId } = action;
    return {
      mediaType: 'action',
      type: 'channelMigrateFrom',
      title,
      chatId: buildApiPeerId(chatId, 'chat'),
    };
  }
  if (action instanceof GramJs.MessageActionPinMessage) {
    return {
      mediaType: 'action',
      type: 'pinMessage',
    };
  }
  if (action instanceof GramJs.MessageActionHistoryClear) {
    return {
      mediaType: 'action',
      type: 'historyClear',
    };
  }
  if (action instanceof GramJs.MessageActionGameScore) {
    const { gameId, score } = action;
    return {
      mediaType: 'action',
      type: 'gameScore',
      gameId: gameId.toString(),
      score,
    };
  }
  if (action instanceof GramJs.MessageActionPaymentSent) {
    const {
      recurringInit, recurringUsed, currency, totalAmount, invoiceSlug, subscriptionUntilDate,
    } = action;
    return {
      mediaType: 'action',
      type: 'paymentSent',
      isRecurringInit: recurringInit,
      isRecurringUsed: recurringUsed,
      currency,
      totalAmount: totalAmount.toJSNumber(),
      invoiceSlug,
      subscriptionUntilDate,
    };
  }
  if (action instanceof GramJs.MessageActionPhoneCall) {
    const {
      video, callId, reason, duration,
    } = action;
    return {
      mediaType: 'action',
      type: 'phoneCall',
      isVideo: video,
      callId: callId.toString(),
      reason: reason && buildApiPhoneCallDiscardReason(reason),
      duration,
    };
  }
  if (action instanceof GramJs.MessageActionScreenshotTaken) {
    return {
      mediaType: 'action',
      type: 'screenshotTaken',
    };
  }
  if (action instanceof GramJs.MessageActionCustomAction) {
    const { message } = action;
    return {
      mediaType: 'action',
      type: 'customAction',
      message,
    };
  }
  if (action instanceof GramJs.MessageActionBotAllowed) {
    const {
      attachMenu, fromRequest, domain, app,
    } = action;
    return {
      mediaType: 'action',
      type: 'botAllowed',
      isAttachMenu: attachMenu,
      isFromRequest: fromRequest,
      domain,
      app: app && buildApiBotApp(app),
    };
  }
  if (action instanceof GramJs.MessageActionBoostApply) {
    const { boosts } = action;
    return {
      mediaType: 'action',
      type: 'boostApply',
      boosts,
    };
  }
  if (action instanceof GramJs.MessageActionContactSignUp) {
    return {
      mediaType: 'action',
      type: 'contactSignUp',
    };
  }
  if (action instanceof GramJs.MessageActionGroupCall) {
    const { call, duration } = action;
    return {
      mediaType: 'action',
      type: 'groupCall',
      call: {
        id: call.id.toString(),
        accessHash: call.accessHash.toString(),
      },
      duration,
    };
  }
  if (action instanceof GramJs.MessageActionInviteToGroupCall) {
    const { call, users } = action;
    return {
      mediaType: 'action',
      type: 'inviteToGroupCall',
      call: {
        id: call.id.toString(),
        accessHash: call.accessHash.toString(),
      },
      userIds: users.map((u) => buildApiPeerId(u, 'user')),
    };
  }
  if (action instanceof GramJs.MessageActionGroupCallScheduled) {
    const { call, scheduleDate } = action;
    return {
      mediaType: 'action',
      type: 'groupCallScheduled',
      call: {
        id: call.id.toString(),
        accessHash: call.accessHash.toString(),
      },
      scheduleDate,
    };
  }
  if (action instanceof GramJs.MessageActionChatJoinedByRequest) {
    return {
      mediaType: 'action',
      type: 'chatJoinedByRequest',
    };
  }
  if (action instanceof GramJs.MessageActionWebViewDataSent) {
    const { text } = action;
    return {
      mediaType: 'action',
      type: 'webViewDataSent',
      text,
    };
  }
  if (action instanceof GramJs.MessageActionGiftPremium) {
    const {
      currency, amount, months, cryptoCurrency, cryptoAmount, message,
    } = action;
    return {
      mediaType: 'action',
      type: 'giftPremium',
      currency,
      amount: amount.toJSNumber(),
      months,
      cryptoCurrency,
      cryptoAmount: cryptoAmount?.toJSNumber(),
      message: message && buildApiFormattedText(message),
    };
  }
  if (action instanceof GramJs.MessageActionTopicCreate) {
    const { title, iconColor, iconEmojiId } = action;
    return {
      mediaType: 'action',
      type: 'topicCreate',
      title,
      iconColor,
      iconEmojiId: iconEmojiId?.toString(),
    };
  }
  if (action instanceof GramJs.MessageActionTopicEdit) {
    const {
      title, iconEmojiId, closed, hidden,
    } = action;
    return {
      mediaType: 'action',
      type: 'topicEdit',
      title,
      iconEmojiId: iconEmojiId?.toString(),
      isClosed: closed,
      isHidden: hidden,
    };
  }
  if (action instanceof GramJs.MessageActionSuggestProfilePhoto) {
    const { photo } = action;

    if (!(photo instanceof GramJs.Photo)) return UNSUPPORTED_ACTION;

    return {
      mediaType: 'action',
      type: 'suggestProfilePhoto',
      photo: buildApiPhoto(photo),
    };
  }
  if (action instanceof GramJs.MessageActionGiftCode) {
    const {
      viaGiveaway, unclaimed, boostPeer, months, slug, currency, amount, cryptoCurrency, cryptoAmount, message,
    } = action;
    return {
      mediaType: 'action',
      type: 'giftCode',
      isViaGiveaway: viaGiveaway,
      isUnclaimed: unclaimed,
      boostPeerId: boostPeer && getApiChatIdFromMtpPeer(boostPeer),
      months,
      slug,
      currency,
      amount: amount?.toJSNumber(),
      cryptoCurrency,
      cryptoAmount: cryptoAmount?.toJSNumber(),
      message: message && buildApiFormattedText(message),
    };
  }
  if (action instanceof GramJs.MessageActionGiveawayLaunch) {
    const { stars } = action;
    return {
      mediaType: 'action',
      type: 'giveawayLaunch',
      stars: stars?.toJSNumber(),
    };
  }
  if (action instanceof GramJs.MessageActionGiveawayResults) {
    const { stars, winnersCount, unclaimedCount } = action;
    return {
      mediaType: 'action',
      type: 'giveawayResults',
      isStars: stars,
      winnersCount,
      unclaimedCount,
    };
  }
  if (action instanceof GramJs.MessageActionPaymentRefunded) {
    const {
      peer, currency, totalAmount,
    } = action;
    return {
      mediaType: 'action',
      type: 'paymentRefunded',
      peerId: getApiChatIdFromMtpPeer(peer),
      currency,
      totalAmount: totalAmount.toJSNumber(),
    };
  }
  if (action instanceof GramJs.MessageActionGiftStars) {
    const {
      currency, amount, stars, cryptoCurrency, cryptoAmount, transactionId,
    } = action;
    return {
      mediaType: 'action',
      type: 'giftStars',
      currency,
      amount: amount.toJSNumber(),
      stars: stars.toJSNumber(),
      cryptoCurrency,
      cryptoAmount: cryptoAmount?.toJSNumber(),
      transactionId,
    };
  }
  if (action instanceof GramJs.MessageActionPrizeStars) {
    const {
      unclaimed, stars, transactionId, boostPeer, giveawayMsgId,
    } = action;
    return {
      mediaType: 'action',
      type: 'prizeStars',
      isUnclaimed: unclaimed,
      stars: stars.toJSNumber(),
      transactionId,
      boostPeerId: getApiChatIdFromMtpPeer(boostPeer),
      giveawayMsgId,
    };
  }
  if (action instanceof GramJs.MessageActionStarGift) {
    const {
      nameHidden, saved, converted, upgraded, refunded, canUpgrade, gift, message, convertStars, upgradeMsgId,
      upgradeStars, fromId, peer, savedId,
    } = action;

    const starGift = buildApiStarGift(gift);
    if (starGift.type !== 'starGift') return UNSUPPORTED_ACTION;

    return {
      mediaType: 'action',
      type: 'starGift',
      isNameHidden: nameHidden,
      isSaved: saved,
      isConverted: converted,
      isUpgraded: upgraded,
      isRefunded: refunded,
      canUpgrade,
      gift: starGift,
      message: message && buildApiFormattedText(message),
      starsToConvert: convertStars?.toJSNumber(),
      upgradeMsgId,
      alreadyPaidUpgradeStars: upgradeStars?.toJSNumber(),
      fromId: fromId && getApiChatIdFromMtpPeer(fromId),
      peerId: peer && getApiChatIdFromMtpPeer(peer),
      savedId: savedId && buildApiPeerId(savedId, 'user'),
    };
  }
  if (action instanceof GramJs.MessageActionStarGiftUnique) {
    const {
      upgrade, transferred, saved, refunded, gift, canExportAt, transferStars, fromId, peer, savedId,
    } = action;

    const starGift = buildApiStarGift(gift);
    if (starGift.type !== 'starGiftUnique') return UNSUPPORTED_ACTION;

    return {
      mediaType: 'action',
      type: 'starGiftUnique',
      isUpgrade: upgrade,
      isTransferred: transferred,
      isSaved: saved,
      isRefunded: refunded,
      gift: starGift,
      canExportAt,
      transferStars: transferStars?.toJSNumber(),
      fromId: fromId && getApiChatIdFromMtpPeer(fromId),
      peerId: peer && getApiChatIdFromMtpPeer(peer),
      savedId: savedId && buildApiPeerId(savedId, 'user'),
    };
  }

  return UNSUPPORTED_ACTION;
}

export function buildApiPhoneCallDiscardReason(reason: GramJs.TypePhoneCallDiscardReason): ApiPhoneCallDiscardReason {
  if (reason instanceof GramJs.PhoneCallDiscardReasonBusy) {
    return 'busy';
  }
  if (reason instanceof GramJs.PhoneCallDiscardReasonHangup) {
    return 'hangup';
  }
  if (reason instanceof GramJs.PhoneCallDiscardReasonMissed) {
    return 'missed';
  }

  return 'disconnect';
}
