import type { ApiPremiumSection } from '../../global/types';
import type { ApiWebDocument } from './bots';
import type { ApiChat } from './chats';
import type {
  ApiDocument,
  ApiFormattedText,
  ApiInvoice,
  ApiMessageEntity,
  ApiPaymentCredentials,
  BoughtPaidMedia,
} from './messages';
import type { ApiStarsSubscriptionPricing } from './misc';
import type { StatisticsOverviewPercentage } from './statistics';
import type { ApiUser } from './users';

export interface ApiShippingAddress {
  streetLine1: string;
  streetLine2: string;
  city: string;
  state: string;
  countryIso2: string;
  postCode: string;
}

export interface ApiPaymentSavedInfo {
  name?: string;
  phone?: string;
  email?: string;
  shippingAddress?: ApiShippingAddress;
}

export interface ApiPaymentFormRegular {
  type: 'regular';
  url: string;
  botId: string;
  canSaveCredentials?: boolean;
  isPasswordMissing?: boolean;
  formId: string;
  providerId: string;
  nativeProvider?: string;
  nativeParams: ApiPaymentFormNativeParams;
  savedInfo?: ApiPaymentSavedInfo;
  savedCredentials?: ApiPaymentCredentials[];
  invoice: ApiInvoice;
  title: string;
  description: string;
  photo?: ApiWebDocument;
}

export interface ApiPaymentFormStars {
  type: 'stars';
  formId: string;
  botId: string;
  title: string;
  description: string;
  photo?: ApiWebDocument;
  invoice: ApiInvoice;
}

export interface ApiPaymentFormStarGift {
  type: 'stargift';
  formId: string;
  invoice: ApiInvoice;
}

export type ApiPaymentForm = ApiPaymentFormRegular | ApiPaymentFormStars | ApiPaymentFormStarGift;

export interface ApiPaymentFormNativeParams {
  needCardholderName?: boolean;
  needCountry?: boolean;
  needZip?: boolean;
  publishableKey?: string;
  publicToken?: string;
  tokenizeUrl?: string;
}

export interface ApiLabeledPrice {
  label: string;
  amount: number;
}

export interface ApiReceiptStars {
  type: 'stars';
  date: number;
  botId: string;
  title: string;
  description: string;
  invoice: ApiInvoice;
  photo?: ApiWebDocument;
  currency: string;
  totalAmount: number;
  transactionId: string;
}

export interface ApiReceiptRegular {
  type: 'regular';
  botId: string;
  providerId: string;
  description: string;
  title: string;
  invoice: ApiInvoice;
  photo?: ApiWebDocument;
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  tipAmount: number;
  totalAmount: number;
  currency: string;
  date: number;
  credentialsTitle: string;
  shippingPrices?: ApiLabeledPrice[];
  shippingMethod?: string;
}

export type ApiReceipt = ApiReceiptRegular | ApiReceiptStars;

export interface ApiPremiumPromo {
  videoSections: ApiPremiumSection[];
  videos: ApiDocument[];
  statusText: string;
  statusEntities: ApiMessageEntity[];
  options: ApiPremiumSubscriptionOption[];
}

export interface ApiPremiumSubscriptionOption {
  isCurrent?: boolean;
  canPurchaseUpgrade?: boolean;
  months: number;
  currency: string;
  amount: number;
  botUrl: string;
}

export type ApiInputStorePaymentGiveaway = {
  type: 'giveaway';
  isOnlyForNewSubscribers?: boolean;
  areWinnersVisible?: boolean;
  chat: ApiChat;
  additionalChannels?: ApiChat[];
  countries?: string[];
  prizeDescription?: string;
  untilDate: number;
  currency: string;
  amount: number;
};

export type ApiInputStorePaymentGiftcode = {
  type: 'giftcode';
  users: ApiUser[];
  boostChannel?: ApiChat;
  currency: string;
  amount: number;
  message?: ApiFormattedText;
};

export type ApiInputStorePaymentStarsTopup = {
  type: 'stars';
  stars: number;
  currency: string;
  amount: number;
};

export type ApiInputStorePaymentStarsGift = {
  type: 'starsgift';
  user: ApiUser;
  stars: number;
  currency: string;
  amount: number;
};

export type ApiInputStorePaymentStarsGiveaway = {
  type: 'starsgiveaway';
  isOnlyForNewSubscribers?: boolean;
  areWinnersVisible?: boolean;
  chat: ApiChat;
  additionalChannels?: ApiChat[];
  stars?: number;
  countries?: string[];
  prizeDescription?: string;
  untilDate: number;
  currency: string;
  amount: number;
  users: number;
};

export type ApiInputStorePaymentPurpose = ApiInputStorePaymentGiveaway | ApiInputStorePaymentGiftcode |
ApiInputStorePaymentStarsTopup | ApiInputStorePaymentStarsGift | ApiInputStorePaymentStarsGiveaway;

export type ApiStarGift = {
  isLimited?: true;
  id: string;
  stickerId: string;
  stars: number;
  availabilityRemains?: number;
  availabilityTotal?: number;
  starsToConvert: number;
  isSoldOut?: true;
  firstSaleDate?: number;
  lastSaleDate?: number;
};

export interface ApiUserStarGift {
  isNameHidden?: boolean;
  isUnsaved?: boolean;
  fromId?: string;
  date: number;
  gift: ApiStarGift;
  message?: ApiFormattedText;
  messageId?: number;
  starsToConvert?: number;
  isConverted?: boolean; // Local field, used for Action Message
}

export interface ApiPremiumGiftCodeOption {
  users: number;
  months: number;
  currency: string;
  amount: number;
}

export interface ApiPrepaidGiveaway {
  type: 'giveaway';
  id: string;
  months: number;
  quantity: number;
  date: number;
}

export type ApiPrepaidStarsGiveaway = {
  type: 'starsGiveaway';
  id: string;
  stars: number;
  quantity: number;
  boosts: number;
  date: number;
};

export type ApiTypePrepaidGiveaway = ApiPrepaidGiveaway | ApiPrepaidStarsGiveaway;

export type ApiBoostsStatus = {
  level: number;
  currentLevelBoosts: number;
  boosts: number;
  nextLevelBoosts?: number;
  hasMyBoost?: boolean;
  boostUrl: string;
  giftBoosts?: number;
  premiumSubscribers?: StatisticsOverviewPercentage;
  prepaidGiveaways?: ApiTypePrepaidGiveaway[];
};

export type ApiMyBoost = {
  slot: number;
  chatId?: string;
  date: number;
  expires: number;
  cooldownUntil?: number;
};

export type ApiBoost = {
  userId?: string;
  multiplier?: number;
  expires: number;
  isFromGiveaway?: boolean;
  isGift?: boolean;
  stars?: number;
};

export type ApiGiveawayInfoActive = {
  type: 'active';
  isParticipating?: true;
  isPreparingResults?: true;
  startDate: number;
  joinedTooEarlyDate?: number;
  adminDisallowedChatId?: string;
  disallowedCountry?: string;
};

export type ApiGiveawayInfoResults = {
  type: 'results';
  isWinner?: true;
  isRefunded?: true;
  startDate: number;
  starsPrize?: number;
  finishDate: number;
  giftCodeSlug?: string;
  winnersCount: number;
  activatedCount?: number;
};

export type ApiGiveawayInfo = ApiGiveawayInfoActive | ApiGiveawayInfoResults;

export type ApiCheckedGiftCode = {
  isFromGiveaway?: true;
  fromId?: string;
  giveawayMessageId?: number;
  toId?: string;
  date: number;
  months: number;
  usedAt?: number;
};

export interface ApiStarsTransactionPeerUnsupported {
  type: 'unsupported';
}

export interface ApiStarsTransactionPeerAppStore {
  type: 'appStore';
}

export interface ApiStarsTransactionPeerPlayMarket {
  type: 'playMarket';
}

export interface ApiStarsTransactionPeerPremiumBot {
  type: 'premiumBot';
}

export interface ApiStarsTransactionPeerFragment {
  type: 'fragment';
}

export interface ApiStarsTransactionPeerAds {
  type: 'ads';
}

export interface ApiStarsTransactionApi {
  type: 'api';
}

export interface ApiStarsTransactionPeerPeer {
  type: 'peer';
  id: string;
}

export type ApiStarsTransactionPeer =
| ApiStarsTransactionPeerUnsupported
| ApiStarsTransactionPeerAppStore
| ApiStarsTransactionPeerPlayMarket
| ApiStarsTransactionPeerPremiumBot
| ApiStarsTransactionPeerFragment
| ApiStarsTransactionPeerAds
| ApiStarsTransactionApi
| ApiStarsTransactionPeerPeer;

export interface ApiStarsTransaction {
  id?: string;
  peer: ApiStarsTransactionPeer;
  messageId?: number;
  stars: number;
  isRefund?: true;
  isGift?: true;
  starGift?: ApiStarGift;
  giveawayPostId?: number;
  isMyGift?: true; // Used only for outgoing star gift messages
  isReaction?: true;
  hasFailed?: true;
  isPending?: true;
  date: number;
  title?: string;
  description?: string;
  photo?: ApiWebDocument;
  extendedMedia?: BoughtPaidMedia[];
  subscriptionPeriod?: number;
}

export interface ApiStarsSubscription {
  id: string;
  peerId: string;
  until: number;
  pricing: ApiStarsSubscriptionPricing;
  isCancelled?: true;
  canRefulfill?: true;
  hasMissingBalance?: true;
  chatInviteHash?: string;
}

export interface ApiStarTopupOption {
  isExtended?: true;
  stars: number;
  currency: string;
  amount: number;
}

export interface ApiStarsGiveawayWinnerOption {
  isDefault?: true;
  users: number;
  perUserStars: number;
}

export interface ApiStarGiveawayOption {
  isExtended?: true;
  isDefault?: true;
  stars: number;
  yearlyBoosts: number;
  currency: string;
  amount: number;
  winners: ApiStarsGiveawayWinnerOption[];
}
