import type {
  ApiInputInvoice,
  ApiMessage,
  ApiRequestInputInvoice,
  ApiStarsTransaction,
  ApiStarsTransactionPeer,
  ApiStarsTransactionPeerPeer,
} from '../../api/types';
import type { CustomPeer } from '../../types';
import type { GlobalState } from '../types';

import { formatInteger } from '../../util/textFormat';
import { selectChat, selectUser } from '../selectors';

export function getRequestInputInvoice<T extends GlobalState>(
  global: T, inputInvoice: ApiInputInvoice,
): ApiRequestInputInvoice | undefined {
  if (inputInvoice.type === 'slug') return inputInvoice;

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
      userIds, boostChannelId, amount, currency, option,
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

  return {
    avatarIcon: 'star',
    isCustomPeer: true,
    titleKey: 'Stars.Intro.Transaction.Unsupported.Title',
    subtitleKey: 'Stars.Intro.Transaction.Unsupported.Title',
    peerColorId: 0,
  };
}

export function formatStarsTransactionAmount(amount: number) {
  if (amount < 0) {
    return `- ${formatInteger(Math.abs(amount))}`;
  }

  return `+ ${formatInteger(amount)}`;
}

export function getStarsTransactionFromGift(message: ApiMessage): ApiStarsTransaction | undefined {
  const { action } = message.content;

  if (action?.type !== 'giftStars') return undefined;

  const { transactionId, stars } = action;

  return {
    id: transactionId!,
    stars: stars!,
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
    stars: stars!,
    peer: {
      type: 'peer',
      id: targetChatId!,
    },
    date: message.date,
    isPrizeStars: true,
  };
}
