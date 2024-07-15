import type { ApiPremiumSection } from '../../global/types';
import type { ApiInvoiceContainer } from '../../types';
import type { ApiWebDocument } from './bots';
import type { ApiChat } from './chats';
import type {
  ApiDocument, ApiMessageEntity, ApiPaymentCredentials, BoughtPaidMedia, MediaContent,
} from './messages';
import type { PrepaidGiveaway, StatisticsOverviewPercentage } from './statistics';
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
  savedInfo?: ApiPaymentSavedInfo;
  savedCredentials?: ApiPaymentCredentials[];
  invoiceContainer: ApiInvoiceContainer;
  nativeParams: ApiPaymentFormNativeParams;
}

export interface ApiPaymentFormStars {
  type: 'stars';
  formId: string;
  botId: string;
}

export type ApiPaymentForm = ApiPaymentFormRegular | ApiPaymentFormStars;

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
  botId?: string;
  peer?: ApiStarsTransactionPeer;
  date: number;
  title?: string;
  text?: string;
  photo?: ApiWebDocument;
  media?: BoughtPaidMedia[];
  currency: string;
  totalAmount: number;
  transactionId: string;
  messageId?: number;
}

export interface ApiReceiptRegular {
  type: 'regular';
  photo?: ApiWebDocument;
  text?: string;
  title?: string;
  currency: string;
  prices: ApiLabeledPrice[];
  info?: {
    shippingAddress?: ApiShippingAddress;
    phone?: string;
    name?: string;
  };
  tipAmount: number;
  totalAmount: number;
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
};

export type ApiInputStorePaymentPurpose = ApiInputStorePaymentGiveaway | ApiInputStorePaymentGiftcode;

export interface ApiPremiumGiftCodeOption {
  users: number;
  months: number;
  currency: string;
  amount: number;
}

export type ApiBoostsStatus = {
  level: number;
  currentLevelBoosts: number;
  boosts: number;
  nextLevelBoosts?: number;
  hasMyBoost?: boolean;
  boostUrl: string;
  premiumSubscribers?: StatisticsOverviewPercentage;
  prepaidGiveaways?: PrepaidGiveaway[];
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
  finishDate: number;
  giftCodeSlug?: string;
  winnersCount: number;
  activatedCount: number;
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

export interface ApiPrepaidGiveaway {
  id: string;
  months: number;
  quantity: number;
  date: number;
}

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
| ApiStarsTransactionPeerPeer;

export interface ApiStarsTransaction {
  id: string;
  peer: ApiStarsTransactionPeer;
  messageId?: number;
  stars: number;
  isRefund?: true;
  hasFailed?: true;
  isPending?: true;
  date: number;
  title?: string;
  description?: string;
  photo?: ApiWebDocument;
  extendedMedia?: MediaContent[];
}

export interface ApiStarTopupOption {
  isExtended?: true;
  stars: number;
  currency: string;
  amount: number;
}
