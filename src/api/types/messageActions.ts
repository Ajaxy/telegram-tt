import type { ApiGroupCall, ApiPhoneCallDiscardReason } from './calls';
import type { ApiBotApp, ApiFormattedText, ApiPhoto } from './messages';
import type { ApiStarGiftRegular, ApiStarGiftUnique } from './stars';

interface ActionMediaType {
  mediaType: 'action';
}

export interface ApiMessageActionChatCreate extends ActionMediaType {
  type: 'chatCreate';
  title: string;
  userIds: string[];
}

export interface ApiMessageActionChatEditTitle extends ActionMediaType {
  type: 'chatEditTitle';
  title: string;
}

export interface ApiMessageActionChatEditPhoto extends ActionMediaType {
  type: 'chatEditPhoto';
  photo?: ApiPhoto;
}

export interface ApiMessageActionChatDeletePhoto extends ActionMediaType {
  type: 'chatDeletePhoto';
}

export interface ApiMessageActionChatAddUser extends ActionMediaType {
  type: 'chatAddUser';
  userIds: string[];
}

export interface ApiMessageActionChatDeleteUser extends ActionMediaType {
  type: 'chatDeleteUser';
  userId: string;
}

export interface ApiMessageActionChatJoinedByLink extends ActionMediaType {
  type: 'chatJoinedByLink';
  inviterId: string;
}

export interface ApiMessageActionChannelCreate extends ActionMediaType {
  type: 'channelCreate';
  title: string;
}

export interface ApiMessageActionChatMigrateTo extends ActionMediaType {
  type: 'chatMigrateTo';
  channelId: string;
}

export interface ApiMessageActionChannelMigrateFrom extends ActionMediaType {
  type: 'channelMigrateFrom';
  title: string;
  chatId: string;
}

export interface ApiMessageActionPinMessage extends ActionMediaType {
  type: 'pinMessage';
}

export interface ApiMessageActionHistoryClear extends ActionMediaType {
  type: 'historyClear';
}

export interface ApiMessageActionGameScore extends ActionMediaType {
  type: 'gameScore';
  gameId: string;
  score: number;
}

export interface ApiMessageActionPaymentSent extends ActionMediaType {
  type: 'paymentSent';
  isRecurringInit?: true;
  isRecurringUsed?: true;
  currency: string;
  totalAmount: number;
  invoiceSlug?: string;
  subscriptionUntilDate?: number;
}

export interface ApiMessageActionPhoneCall extends ActionMediaType {
  type: 'phoneCall';
  isVideo?: true;
  callId: string;
  reason?: ApiPhoneCallDiscardReason;
  duration?: number;
}

export interface ApiMessageActionScreenshotTaken extends ActionMediaType {
  type: 'screenshotTaken';
}

export interface ApiMessageActionCustomAction extends ActionMediaType {
  type: 'customAction';
  message: string;
}

export interface ApiMessageActionBotAllowed extends ActionMediaType {
  type: 'botAllowed';
  isAttachMenu?: true;
  isFromRequest?: true;
  domain?: string;
  app?: ApiBotApp;
}

export interface ApiMessageActionContactSignUp extends ActionMediaType {
  type: 'contactSignUp';
}

export interface ApiMessageActionGroupCall extends ActionMediaType {
  type: 'groupCall';
  call: Pick<ApiGroupCall, 'id' | 'accessHash'>;
  duration?: number;
}

export interface ApiMessageActionInviteToGroupCall extends ActionMediaType {
  type: 'inviteToGroupCall';
  call: Pick<ApiGroupCall, 'id' | 'accessHash'>;
  userIds: string[];
}

export interface ApiMessageActionGroupCallScheduled extends ActionMediaType {
  type: 'groupCallScheduled';
  call: Pick<ApiGroupCall, 'id' | 'accessHash'>;
  scheduleDate: number;
}

export interface ApiMessageActionChatJoinedByRequest extends ActionMediaType {
  type: 'chatJoinedByRequest';
}

export interface ApiMessageActionWebViewDataSent extends ActionMediaType {
  type: 'webViewDataSent';
  text: string;
}

export interface ApiMessageActionGiftPremium extends ActionMediaType {
  type: 'giftPremium';
  currency: string;
  amount: number;
  months: number;
  cryptoCurrency?: string;
  cryptoAmount?: number;
  message?: ApiFormattedText;
}

export interface ApiMessageActionTopicCreate extends ActionMediaType {
  type: 'topicCreate';
  title: string;
  iconColor: number;
  iconEmojiId?: string;
}

export interface ApiMessageActionTopicEdit extends ActionMediaType {
  type: 'topicEdit';
  title?: string;
  iconEmojiId?: string;
  isClosed?: boolean;
  isHidden?: boolean;
}

export interface ApiMessageActionSuggestProfilePhoto extends ActionMediaType {
  type: 'suggestProfilePhoto';
  photo: ApiPhoto;
}

export interface ApiMessageActionGiftCode extends ActionMediaType {
  type: 'giftCode';
  isViaGiveaway?: true;
  isUnclaimed?: true;
  boostPeerId?: string;
  months: number;
  slug: string;
  currency?: string;
  amount?: number;
  cryptoCurrency?: string;
  cryptoAmount?: number;
  message?: ApiFormattedText;
}

export interface ApiMessageActionGiveawayLaunch extends ActionMediaType {
  type: 'giveawayLaunch';
  stars?: number;
}

export interface ApiMessageActionGiveawayResults extends ActionMediaType {
  type: 'giveawayResults';
  isStars?: true;
  winnersCount: number;
  unclaimedCount: number;
}

export interface ApiMessageActionBoostApply extends ActionMediaType {
  type: 'boostApply';
  boosts: number;
}

export interface ApiMessageActionPaymentRefunded extends ActionMediaType {
  type: 'paymentRefunded';
  peerId: string;
  currency: string;
  totalAmount: number;
}

export interface ApiMessageActionGiftStars extends ActionMediaType {
  type: 'giftStars';
  currency: string;
  amount: number;
  stars: number;
  cryptoCurrency?: string;
  cryptoAmount?: number;
  transactionId?: string;
}

export interface ApiMessageActionPrizeStars extends ActionMediaType {
  type: 'prizeStars';
  isUnclaimed?: true;
  stars: number;
  transactionId: string;
  boostPeerId: string;
  giveawayMsgId: number;
}

export interface ApiMessageActionStarGift extends ActionMediaType {
  type: 'starGift';
  isNameHidden?: true;
  isSaved?: true;
  isConverted?: true;
  isUpgraded?: true;
  isRefunded?: true;
  canUpgrade?: true;
  gift: ApiStarGiftRegular;
  message?: ApiFormattedText;
  starsToConvert?: number;
  upgradeMsgId?: number;
  alreadyPaidUpgradeStars?: number;
  fromId?: string;
  peerId?: string;
  savedId?: string;
}

export interface ApiMessageActionStarGiftUnique extends ActionMediaType {
  type: 'starGiftUnique';
  isUpgrade?: true;
  isTransferred?: true;
  isSaved?: true;
  isRefunded?: true;
  gift: ApiStarGiftUnique;
  canExportAt?: number;
  transferStars?: number;
  fromId?: string;
  peerId?: string;
  savedId?: string;
}

export interface ApiMessageActionChannelJoined extends ActionMediaType {
  type: 'channelJoined';
  isViaRequest?: true;
  inviterId?: string;
}

export interface ApiMessageActionExpiredContent extends ActionMediaType {
  type: 'expired';
  isVoice?: true;
  isRoundVideo?: true;
}

export interface ApiMessageActionUnsupported extends ActionMediaType {
  type: 'unsupported';
}

export type ApiMessageAction = ApiMessageActionUnsupported | ApiMessageActionChatCreate | ApiMessageActionChatEditTitle
| ApiMessageActionChatEditPhoto | ApiMessageActionChatDeletePhoto | ApiMessageActionChatAddUser
| ApiMessageActionChatDeleteUser | ApiMessageActionChatJoinedByLink | ApiMessageActionChannelCreate
| ApiMessageActionChatMigrateTo | ApiMessageActionChannelMigrateFrom | ApiMessageActionPinMessage
| ApiMessageActionHistoryClear | ApiMessageActionGameScore | ApiMessageActionPaymentSent | ApiMessageActionPhoneCall
| ApiMessageActionScreenshotTaken | ApiMessageActionCustomAction | ApiMessageActionBotAllowed
| ApiMessageActionBoostApply | ApiMessageActionContactSignUp | ApiMessageActionExpiredContent
| ApiMessageActionGroupCall | ApiMessageActionInviteToGroupCall | ApiMessageActionGroupCallScheduled
| ApiMessageActionChatJoinedByRequest | ApiMessageActionWebViewDataSent | ApiMessageActionGiftPremium
| ApiMessageActionTopicCreate | ApiMessageActionTopicEdit | ApiMessageActionSuggestProfilePhoto
| ApiMessageActionChannelJoined | ApiMessageActionGiftCode | ApiMessageActionGiveawayLaunch
| ApiMessageActionGiveawayResults | ApiMessageActionPaymentRefunded | ApiMessageActionGiftStars
| ApiMessageActionPrizeStars | ApiMessageActionStarGift | ApiMessageActionStarGiftUnique;
