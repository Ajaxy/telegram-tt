import type { ApiWebDocument } from './bots';
import type { ApiChat } from './chats';
import type { ApiFormattedText, ApiSticker, BoughtPaidMedia } from './messages';

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
  giftAddress?: string;
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
  isPinned?: boolean;
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
