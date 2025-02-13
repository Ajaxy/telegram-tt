import type {
  ApiInputInvoice,
  ApiInputSavedStarGift,
  ApiMessage,
  ApiRequestInputInvoice,
  ApiRequestInputSavedStarGift,
  ApiStarsAmount,
  ApiStarsTransaction,
  ApiStarsTransactionPeer,
  ApiStarsTransactionPeerPeer,
} from '../../api/types';
import type { CustomPeer } from '../../types';
import type { LangFn } from '../../util/localization';
import type { GlobalState } from '../types';

import arePropsShallowEqual from '../../util/arePropsShallowEqual';
import { selectChat, selectPeer, selectUser } from '../selectors';

export function getRequestInputInvoice<T extends GlobalState>(
  global: T, inputInvoice: ApiInputInvoice,
): ApiRequestInputInvoice | undefined {
  if (inputInvoice.type === 'slug') return inputInvoice;

  if (inputInvoice.type === 'stargift') {
    const {
      peerId, shouldHideName, giftId, message, shouldUpgrade,
    } = inputInvoice;
    const peer = selectPeer(global, peerId);

    if (!peer) return undefined;

    return {
      type: 'stargift',
      peer,
      shouldHideName,
      giftId,
      message,
      shouldUpgrade,
    };
  }

  if (inputInvoice.type === 'starsgift') {
    const {
      userId, stars, amount, currency,
    } = inputInvoice;
    const user = selectUser(global, userId);

    if (!user) return undefined;

    return {
      type: 'stars',
      purpose: {
        type: 'starsgift',
        user,
        stars,
        amount,
        currency,
      },
    };
  }

  if (inputInvoice.type === 'stars') {
    const {
      stars, amount, currency,
    } = inputInvoice;

    return {
      type: 'stars',
      purpose: {
        type: 'stars',
        stars,
        amount,
        currency,
      },
    };
  }

  if (inputInvoice.type === 'chatInviteSubscription') {
    const { hash } = inputInvoice;

    return {
      type: 'chatInviteSubscription',
      hash,
    };
  }

  if (inputInvoice.type === 'message') {
    const chat = selectChat(global, inputInvoice.chatId);
    if (!chat) {
      return undefined;
    }
    return {
      type: 'message',
      chat,
      messageId: inputInvoice.messageId,
    };
  }

  if (inputInvoice.type === 'giftcode') {
    const {
      userIds, boostChannelId, amount, currency, option, message,
    } = inputInvoice;
    const users = userIds.map((id) => selectUser(global, id)).filter(Boolean);
    const boostChannel = boostChannelId ? selectChat(global, boostChannelId) : undefined;

    return {
      type: 'giveaway',
      option,
      purpose: {
        type: 'giftcode',
        amount,
        currency,
        users,
        boostChannel,
        message,
      },
    };
  }

  if (inputInvoice.type === 'starsgiveaway') {
    const {
      chatId, additionalChannelIds, amount, currency, untilDate, areWinnersVisible, countries,
      isOnlyForNewSubscribers, prizeDescription, stars, users,
    } = inputInvoice;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return undefined;
    }
    const additionalChannels = additionalChannelIds?.map((id) => selectChat(global, id)).filter(Boolean);

    return {
      type: 'starsgiveaway',
      purpose: {
        type: 'starsgiveaway',
        amount,
        currency,
        chat,
        additionalChannels,
        untilDate,
        areWinnersVisible,
        countries,
        isOnlyForNewSubscribers,
        prizeDescription,
        stars,
        users,
      },
    };
  }

  if (inputInvoice.type === 'giveaway') {
    const {
      chatId, additionalChannelIds, amount, currency, option, untilDate, areWinnersVisible, countries,
      isOnlyForNewSubscribers, prizeDescription,
    } = inputInvoice;
    const chat = selectChat(global, chatId);
    if (!chat) {
      return undefined;
    }
    const additionalChannels = additionalChannelIds?.map((id) => selectChat(global, id)).filter(Boolean);

    return {
      type: 'giveaway',
      option,
      purpose: {
        type: 'giveaway',
        amount,
        currency,
        chat,
        additionalChannels,
        untilDate,
        areWinnersVisible,
        countries,
        isOnlyForNewSubscribers,
        prizeDescription,
      },
    };
  }

  if (inputInvoice.type === 'stargiftUpgrade') {
    const { inputSavedGift, shouldKeepOriginalDetails } = inputInvoice;
    const savedGift = getRequestInputSavedStarGift(global, inputSavedGift);
    if (!savedGift) return undefined;

    return {
      type: 'stargiftUpgrade',
      inputSavedGift: savedGift,
      shouldKeepOriginalDetails,
    };
  }

  if (inputInvoice.type === 'stargiftTransfer') {
    const { inputSavedGift, recipientId } = inputInvoice;
    const savedGift = getRequestInputSavedStarGift(global, inputSavedGift);
    const peer = selectPeer(global, recipientId);
    if (!savedGift || !peer) return undefined;

    return {
      type: 'stargiftTransfer',
      inputSavedGift: savedGift,
      recipient: peer,
    };
  }

  return undefined;
}

export function getRequestInputSavedStarGift<T extends GlobalState>(
  global: T, inputGift: ApiInputSavedStarGift,
): ApiRequestInputSavedStarGift | undefined {
  if (inputGift.type === 'user') return inputGift;

  if (inputGift.type === 'chat') {
    const chat = selectChat(global, inputGift.chatId);
    if (!chat) return undefined;

    return {
      type: 'chat',
      chat,
      savedId: inputGift.savedId,
    };
  }

  return undefined;
}

export function buildStarsTransactionCustomPeer(
  peer: Exclude<ApiStarsTransactionPeer, ApiStarsTransactionPeerPeer>,
): CustomPeer {
  if (peer.type === 'appStore') {
    return {
      avatarIcon: 'star',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.AppleTopUp.Title',
      subtitleKey: 'Stars.Intro.Transaction.AppleTopUp.Subtitle',
      peerColorId: 5,
    };
  }

  if (peer.type === 'playMarket') {
    return {
      avatarIcon: 'star',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.GoogleTopUp.Title',
      subtitleKey: 'Stars.Intro.Transaction.GoogleTopUp.Subtitle',
      peerColorId: 3,
    };
  }

  if (peer.type === 'fragment') {
    return {
      avatarIcon: 'star',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.FragmentTopUp.Title',
      subtitleKey: 'Stars.Intro.Transaction.FragmentTopUp.Subtitle',
      customPeerAvatarColor: '#000000',
    };
  }

  if (peer.type === 'premiumBot') {
    return {
      avatarIcon: 'star',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.PremiumBotTopUp.Title',
      subtitleKey: 'Stars.Intro.Transaction.PremiumBotTopUp.Subtitle',
      peerColorId: 1,
      withPremiumGradient: true,
    };
  }

  if (peer.type === 'ads') {
    return {
      avatarIcon: 'star',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.TelegramAds.Title',
      subtitleKey: 'Stars.Intro.Transaction.TelegramAds.Subtitle',
      peerColorId: 2,
    };
  }

  if (peer.type === 'api') {
    return {
      avatarIcon: 'bots',
      isCustomPeer: true,
      titleKey: 'Stars.Intro.Transaction.TelegramBotApi.Title',
      subtitleKey: 'Stars.Intro.Transaction.TelegramBotApi.Subtitle',
      peerColorId: 4,
    };
  }

  return {
    avatarIcon: 'star',
    isCustomPeer: true,
    titleKey: 'Stars.Intro.Transaction.Unsupported.Title',
    subtitleKey: 'Stars.Intro.Transaction.Unsupported.Title',
    peerColorId: 0,
  };
}

export function formatStarsTransactionAmount(lang: LangFn, starsAmount: ApiStarsAmount) {
  const amount = starsAmount.amount + starsAmount.nanos / 1e9;
  if (amount < 0) {
    return `- ${lang.number(Math.abs(amount))}`;
  }

  return `+ ${lang.number(amount)}`;
}

export function formatStarsAmount(lang: LangFn, starsAmount: ApiStarsAmount) {
  return lang.number(starsAmount.amount + starsAmount.nanos / 1e9);
}

export function getStarsTransactionFromGift(message: ApiMessage): ApiStarsTransaction | undefined {
  const { action } = message.content;

  if (action?.type !== 'giftStars') return undefined;

  const { transactionId, stars } = action;

  return {
    id: transactionId!,
    stars: {
      amount: stars!,
      nanos: 0,
    },
    peer: {
      type: 'peer',
      id: message.isOutgoing ? message.chatId : (message.senderId || message.chatId),
    },
    date: message.date,
    isGift: true,
    isMyGift: message.isOutgoing || undefined,
  };
}

export function getPrizeStarsTransactionFromGiveaway(message: ApiMessage): ApiStarsTransaction | undefined {
  const { action } = message.content;

  if (action?.type !== 'prizeStars') return undefined;

  const { transactionId, stars, targetChatId } = action;

  return {
    id: transactionId!,
    stars: {
      amount: stars!,
      nanos: 0,
    },
    peer: {
      type: 'peer',
      id: targetChatId!,
    },
    date: message.date,
    giveawayPostId: message.id,
  };
}

export function areInputSavedGiftsEqual(one: ApiInputSavedStarGift, two: ApiInputSavedStarGift) {
  return arePropsShallowEqual(one, two);
}
