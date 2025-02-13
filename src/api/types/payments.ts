import type { PREMIUM_FEATURE_SECTIONS } from '../../config';
import type { ApiWebDocument } from './bots';
import type { ApiChat, ApiPeer } from './chats';
import type {
  ApiDocument,
  ApiFormattedText,
  ApiInvoice,
  ApiMessageEntity,
  ApiPaymentCredentials,
  ApiSticker,
  BoughtPaidMedia,
} from './messages';
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

export type ApiPremiumSection = typeof PREMIUM_FEATURE_SECTIONS[number];

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

export interface ApiStarGiftRegular {
  type: 'starGift';
  isLimited?: true;
  id: string;
  sticker: ApiSticker;
  stars: number;
  availabilityRemains?: number;
  availabilityTotal?: number;
  starsToConvert: number;
  isSoldOut?: true;
  firstSaleDate?: number;
  lastSaleDate?: number;
  isBirthday?: true;
  upgradeStars?: number;
}

export interface ApiStarGiftUnique {
  type: 'starGiftUnique';
  id: string;
  title: string;
  number: number;
  ownerId?: string;
  ownerName?: string;
  ownerAddress?: string;
  issuedCount: number;
  totalCount: number;
  attributes: ApiStarGiftAttribute[];
  slug: string;
}

export type ApiStarGift = ApiStarGiftRegular | ApiStarGiftUnique;

export interface ApiStarGiftAttributeModel {
  type: 'model';
  name: string;
  rarityPercent: number;
  sticker: ApiSticker;
}

export interface ApiStarGiftAttributePattern {
  type: 'pattern';
  name: string;
  rarityPercent: number;
  sticker: ApiSticker;
}

export interface ApiStarGiftAttributeBackdrop {
  type: 'backdrop';
  name: string;
  centerColor: string;
  edgeColor: string;
  patternColor: string;
  textColor: string;
  rarityPercent: number;
}

export interface ApiStarGiftAttributeOriginalDetails {
  type: 'originalDetails';
  senderId?: string;
  recipientId: string;
  date: number;
  message?: ApiFormattedText;
}

export type ApiStarGiftAttribute = ApiStarGiftAttributeModel | ApiStarGiftAttributePattern
| ApiStarGiftAttributeBackdrop | ApiStarGiftAttributeOriginalDetails;

export interface ApiSavedStarGift {
  isNameHidden?: boolean;
  isUnsaved?: boolean;
  fromId?: string;
  date: number;
  gift: ApiStarGift;
  inputGift?: ApiInputSavedStarGift;
  savedId?: string;
  message?: ApiFormattedText;
  messageId?: number;
  starsToConvert?: number;
  canUpgrade?: true;
  alreadyPaidUpgradeStars?: number;
  transferStars?: number;
  canExportAt?: number;
  isConverted?: boolean; // Local field, used for Action Message
  upgradeMsgId?: number; // Local field, used for Action Message
}

export interface ApiInputSavedStarGiftUser {
  type: 'user';
  messageId: number;
}

export interface ApiInputSavedStarGiftChat {
  type: 'chat';
  chatId: string;
  savedId: string;
}

export type ApiInputSavedStarGift = ApiInputSavedStarGiftUser | ApiInputSavedStarGiftChat;

export type ApiRequestInputSavedStarGiftUser = ApiInputSavedStarGiftUser;
export type ApiRequestInputSavedStarGiftChat = {
  type: 'chat';
  chat: ApiChat;
  savedId: string;
};
export type ApiRequestInputSavedStarGift = ApiRequestInputSavedStarGiftUser | ApiRequestInputSavedStarGiftChat;

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

export interface ApiStarsAmount {
  amount: number;
  nanos: number;
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
  stars: ApiStarsAmount;
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
  starRefCommision?: number;
  isGiftUpgrade?: true;
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
  hasBotCancelled?: true;
  title?: string;
  photo?: ApiWebDocument;
  invoiceSlug?: string;
}

export type ApiStarsSubscriptionPricing = {
  period: number;
  amount: number;
};

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

export type ApiPaymentStatus = 'paid' | 'failed' | 'pending' | 'cancelled';

/* Used for Invoice UI */
export type ApiInputInvoiceMessage = {
  type: 'message';
  chatId: string;
  messageId: number;
  isExtendedMedia?: boolean;
};

export type ApiInputInvoiceSlug = {
  type: 'slug';
  slug: string;
};

export type ApiInputInvoiceGiveaway = {
  type: 'giveaway';
  chatId: string;
  additionalChannelIds?: string[];
  isOnlyForNewSubscribers?: boolean;
  areWinnersVisible?: boolean;
  prizeDescription?: string;
  countries?: string[];
  untilDate: number;
  currency: string;
  amount: number;
  option: ApiPremiumGiftCodeOption;
};

export type ApiInputInvoiceGiftCode = {
  type: 'giftcode';
  userIds: string[];
  boostChannelId?: string;
  currency: string;
  amount: number;
  option: ApiPremiumGiftCodeOption;
  message?: ApiFormattedText;
};

export type ApiInputInvoiceStars = {
  type: 'stars';
  stars: number;
  currency: string;
  amount: number;
};

export type ApiInputInvoiceStarsGift = {
  type: 'starsgift';
  userId: string;
  stars: number;
  currency: string;
  amount: number;
};

export type ApiInputInvoiceStarGift = {
  type: 'stargift';
  shouldHideName?: boolean;
  peerId: string;
  giftId: string;
  message?: ApiFormattedText;
  shouldUpgrade?: true;
};

export type ApiInputInvoiceStarsGiveaway = {
  type: 'starsgiveaway';
  chatId: string;
  additionalChannelIds?: string[];
  isOnlyForNewSubscribers?: boolean;
  areWinnersVisible?: boolean;
  prizeDescription?: string;
  countries?: string[];
  untilDate: number;
  currency: string;
  amount: number;
  stars: number;
  users: number;
};

export type ApiInputInvoiceChatInviteSubscription = {
  type: 'chatInviteSubscription';
  hash: string;
};

export type ApiInputInvoiceStarGiftUpgrade = {
  type: 'stargiftUpgrade';
  inputSavedGift: ApiInputSavedStarGift;
  shouldKeepOriginalDetails?: true;
};

export type ApiInputInvoiceStarGiftTransfer = {
  type: 'stargiftTransfer';
  inputSavedGift: ApiInputSavedStarGift;
  recipientId: string;
};

export type ApiInputInvoice = ApiInputInvoiceMessage | ApiInputInvoiceSlug | ApiInputInvoiceGiveaway
| ApiInputInvoiceGiftCode | ApiInputInvoiceStars | ApiInputInvoiceStarsGift
| ApiInputInvoiceStarsGiveaway | ApiInputInvoiceStarGift | ApiInputInvoiceChatInviteSubscription
| ApiInputInvoiceStarGiftUpgrade | ApiInputInvoiceStarGiftTransfer;

/* Used for Invoice request */
export type ApiRequestInputInvoiceMessage = {
  type: 'message';
  chat: ApiChat;
  messageId: number;
};

export type ApiRequestInputInvoiceSlug = {
  type: 'slug';
  slug: string;
};

export type ApiRequestInputInvoiceGiveaway = {
  type: 'giveaway';
  purpose: ApiInputStorePaymentPurpose;
  option: ApiPremiumGiftCodeOption;
};

export type ApiRequestInputInvoiceStars = {
  type: 'stars';
  purpose: ApiInputStorePaymentPurpose;
};

export type ApiRequestInputInvoiceStarsGiveaway = {
  type: 'starsgiveaway';
  purpose: ApiInputStorePaymentPurpose;
};

export type ApiRequestInputInvoiceStarGift = {
  type: 'stargift';
  shouldHideName?: boolean;
  peer: ApiPeer;
  giftId: string;
  message?: ApiFormattedText;
  shouldUpgrade?: true;
};

export type ApiRequestInputInvoiceChatInviteSubscription = {
  type: 'chatInviteSubscription';
  hash: string;
};

export type ApiRequestInputInvoiceStarGiftUpgrade = {
  type: 'stargiftUpgrade';
  inputSavedGift: ApiRequestInputSavedStarGift;
  shouldKeepOriginalDetails?: true;
};

export type ApiRequestInputInvoiceStarGiftTransfer = {
  type: 'stargiftTransfer';
  inputSavedGift: ApiRequestInputSavedStarGift;
  recipient: ApiPeer;
};

export type ApiRequestInputInvoice = ApiRequestInputInvoiceMessage | ApiRequestInputInvoiceSlug
| ApiRequestInputInvoiceGiveaway | ApiRequestInputInvoiceStars | ApiRequestInputInvoiceStarsGiveaway
| ApiRequestInputInvoiceChatInviteSubscription | ApiRequestInputInvoiceStarGift | ApiRequestInputInvoiceStarGiftUpgrade
| ApiRequestInputInvoiceStarGiftTransfer;
