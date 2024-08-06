import type { ThreadId } from '../../types';
import type { ApiWebDocument } from './bots';
import type { ApiGroupCall, PhoneCallAction } from './calls';
import type { ApiChat, ApiPeerColor } from './chats';
import type { ApiInputStorePaymentPurpose, ApiPremiumGiftCodeOption, ApiStarTopupOption } from './payments';
import type { ApiMessageStoryData, ApiWebPageStickerData, ApiWebPageStoryData } from './stories';

export interface ApiDimensions {
  width: number;
  height: number;
}

export interface ApiPhotoSize extends ApiDimensions {
  type: 's' | 'm' | 'x' | 'y' | 'w';
}

export interface ApiVideoSize extends ApiDimensions {
  type: 'u' | 'v';
  videoStartTs: number;
  size: number;
}

export interface ApiThumbnail extends ApiDimensions {
  dataUri: string;
}

export interface ApiPhoto {
  mediaType: 'photo';
  id: string;
  date: number;
  thumbnail?: ApiThumbnail;
  isVideo?: boolean;
  sizes: ApiPhotoSize[];
  videoSizes?: ApiVideoSize[];
  blobUrl?: string;
  isSpoiler?: boolean;
}

export interface ApiSticker {
  mediaType: 'sticker';
  id: string;
  stickerSetInfo: ApiStickerSetInfo;
  emoji?: string;
  isCustomEmoji?: boolean;
  isLottie: boolean;
  isVideo: boolean;
  width?: number;
  height?: number;
  thumbnail?: ApiThumbnail;
  isPreloadedGlobally?: boolean;
  hasEffect?: boolean;
  isFree?: boolean;
  shouldUseTextColor?: boolean;
}

export interface ApiStickerSet {
  isArchived?: true;
  isEmoji?: true;
  installedDate?: number;
  id: string;
  accessHash: string;
  title: string;
  hasThumbnail?: boolean;
  hasStaticThumb?: boolean;
  hasAnimatedThumb?: boolean;
  hasVideoThumb?: boolean;
  thumbCustomEmojiId?: string;
  count: number;
  stickers?: ApiSticker[];
  packs?: Record<string, ApiSticker[]>;
  covers?: ApiSticker[];
  shortName: string;
}

type ApiStickerSetInfoShortName = {
  shortName: string;
};

type ApiStickerSetInfoId = {
  id: string;
  accessHash: string;
};

type ApiStickerSetInfoMissing = {
  isMissing: true;
};

export type ApiStickerSetInfo = ApiStickerSetInfoShortName | ApiStickerSetInfoId | ApiStickerSetInfoMissing;

export interface ApiVideo {
  mediaType: 'video';
  id: string;
  mimeType: string;
  duration: number;
  fileName: string;
  width?: number;
  height?: number;
  supportsStreaming?: boolean;
  isRound?: boolean;
  isGif?: boolean;
  hasVideoPreview?: boolean;
  isSpoiler?: boolean;
  thumbnail?: ApiThumbnail;
  blobUrl?: string;
  previewBlobUrl?: string;
  size: number;
  noSound?: boolean;
}

export interface ApiAudio {
  mediaType: 'audio';
  id: string;
  size: number;
  mimeType: string;
  fileName: string;
  duration: number;
  performer?: string;
  title?: string;
  thumbnailSizes?: ApiPhotoSize[];
}

export interface ApiVoice {
  mediaType: 'voice';
  id: string;
  duration: number;
  waveform?: number[];
  size: number;
}

export interface ApiDocument {
  mediaType: 'document';
  id?: string;
  fileName: string;
  size: number;
  timestamp?: number;
  mimeType: string;
  thumbnail?: ApiThumbnail;
  previewBlobUrl?: string;
  innerMediaType?: 'photo' | 'video';
  mediaSize?: ApiDimensions;
}

export interface ApiContact {
  mediaType: 'contact';
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userId: string;
}

export type ApiPaidMedia = {
  mediaType: 'paidMedia';
  starsAmount: number;
} & ({
  isBought?: true;
  extendedMedia: BoughtPaidMedia[];
} | {
  isBought?: undefined;
  extendedMedia: ApiMediaExtendedPreview[];
});

export interface ApiPollAnswer {
  text: ApiFormattedText;
  option: string;
}

export interface ApiPollResult {
  isChosen?: true;
  isCorrect?: true;
  option: string;
  votersCount: number;
}

export interface ApiPoll {
  mediaType: 'poll';
  id: string;
  summary: {
    closed?: true;
    isPublic?: true;
    multipleChoice?: true;
    quiz?: true;
    question: ApiFormattedText;
    answers: ApiPollAnswer[];
    closePeriod?: number;
    closeDate?: number;
  };
  results: {
    isMin?: true;
    results?: ApiPollResult[];
    totalVoters?: number;
    recentVoterIds?: string[];
    solution?: string;
    solutionEntities?: ApiMessageEntity[];
  };
}

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
};

export type ApiInputInvoiceStars = {
  type: 'stars';
  option: ApiStarTopupOption;
};

export type ApiInputInvoice = ApiInputInvoiceMessage | ApiInputInvoiceSlug | ApiInputInvoiceGiveaway
| ApiInputInvoiceGiftCode | ApiInputInvoiceStars;

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
  option: ApiStarTopupOption;
};

export type ApiRequestInputInvoice = ApiRequestInputInvoiceMessage | ApiRequestInputInvoiceSlug
| ApiRequestInputInvoiceGiveaway | ApiRequestInputInvoiceStars;

export interface ApiInvoice {
  mediaType: 'invoice';
  text: string;
  title: string;
  photo?: ApiWebDocument;
  amount: number;
  currency: string;
  receiptMsgId?: number;
  isTest?: boolean;
  isRecurring?: boolean;
  termsUrl?: string;
  extendedMedia?: ApiMediaExtendedPreview;
  maxTipAmount?: number;
  suggestedTipAmounts?: number[];
}

export interface ApiMediaExtendedPreview {
  mediaType: 'extendedMediaPreview';
  width?: number;
  height?: number;
  thumbnail?: ApiThumbnail;
  duration?: number;
}

export interface ApiPaymentCredentials {
  id: string;
  title: string;
}

export interface ApiGeoPoint {
  long: number;
  lat: number;
  accessHash: string;
  accuracyRadius?: number;
}

interface ApiGeo {
  mediaType: 'geo';
  geo: ApiGeoPoint;
}

interface ApiVenue {
  mediaType: 'venue';
  geo: ApiGeoPoint;
  title: string;
  address: string;
  provider: string;
  venueId: string;
  venueType: string;
}

interface ApiGeoLive {
  mediaType: 'geoLive';
  geo: ApiGeoPoint;
  heading?: number;
  period: number;
}

export type ApiLocation = ApiGeo | ApiVenue | ApiGeoLive;

export type ApiGame = {
  mediaType: 'game';
  title: string;
  description: string;
  photo?: ApiPhoto;
  shortName: string;
  id: string;
  accessHash: string;
  document?: ApiDocument;
};

export type ApiGiveaway = {
  mediaType: 'giveaway';
  quantity: number;
  months: number;
  untilDate: number;
  isOnlyForNewSubscribers?: true;
  countries?: string[];
  channelIds: string[];
  prizeDescription?: string;
};

export type ApiGiveawayResults = {
  mediaType: 'giveawayResults';
  months: number;
  untilDate: number;
  isRefunded?: true;
  isOnlyForNewSubscribers?: true;
  channelId: string;
  prizeDescription?: string;
  winnersCount?: number;
  winnerIds: string[];
  additionalPeersCount?: number;
  launchMessageId: number;
  unclaimedCount: number;
};

export type ApiNewPoll = {
  summary: ApiPoll['summary'];
  quiz?: {
    correctAnswers: string[];
    solution?: string;
    solutionEntities?: ApiMessageEntity[];
  };
};

export interface ApiAction {
  mediaType: 'action';
  text: string;
  targetUserIds?: string[];
  targetChatId?: string;
  type:
  | 'historyClear'
  | 'contactSignUp'
  | 'chatCreate'
  | 'topicCreate'
  | 'suggestProfilePhoto'
  | 'joinedChannel'
  | 'chatBoost'
  | 'receipt'
  | 'other';
  photo?: ApiPhoto;
  amount?: number;
  currency?: string;
  giftCryptoInfo?: {
    currency: string;
    amount: number;
  };
  translationValues: string[];
  call?: Partial<ApiGroupCall>;
  phoneCall?: PhoneCallAction;
  score?: number;
  months?: number;
  topicEmojiIconId?: string;
  isTopicAction?: boolean;
  slug?: string;
  isGiveaway?: boolean;
  isUnclaimed?: boolean;
  pluralValue?: number;
}

export interface ApiWebPage {
  mediaType: 'webpage';
  id: number;
  url: string;
  displayUrl: string;
  type?: string;
  siteName?: string;
  title?: string;
  description?: string;
  photo?: ApiPhoto;
  audio?: ApiAudio;
  duration?: number;
  document?: ApiDocument;
  video?: ApiVideo;
  story?: ApiWebPageStoryData;
  stickers?: ApiWebPageStickerData;
}

export type ApiReplyInfo = ApiMessageReplyInfo | ApiStoryReplyInfo;

export interface ApiMessageReplyInfo {
  type: 'message';
  replyToMsgId?: number;
  replyToPeerId?: string;
  replyFrom?: ApiMessageForwardInfo;
  replyMedia?: MediaContent;
  replyToTopId?: number;
  isForumTopic?: true;
  isQuote?: true;
  quoteText?: ApiFormattedText;
}

export interface ApiStoryReplyInfo {
  type: 'story';
  peerId: string;
  storyId: number;
}

export interface ApiInputMessageReplyInfo {
  type: 'message';
  replyToMsgId: number;
  replyToTopId?: number;
  replyToPeerId?: string;
  quoteText?: ApiFormattedText;
}

export interface ApiInputStoryReplyInfo {
  type: 'story';
  peerId: string;
  storyId: number;
}

export type ApiInputReplyInfo = ApiInputMessageReplyInfo | ApiInputStoryReplyInfo;

export interface ApiMessageForwardInfo {
  date: number;
  savedDate?: number;
  isImported?: boolean;
  isChannelPost: boolean;
  channelPostId?: number;
  isLinkedChannelPost?: boolean;
  fromChatId?: string;
  fromId?: string;
  savedFromPeerId?: string;
  fromMessageId?: number;
  hiddenUserName?: string;
  postAuthorTitle?: string;
}

export interface ApiStoryForwardInfo {
  fromPeerId?: string;
  fromName?: string;
  storyId?: number;
  isModified?: boolean;
}

export type ApiMessageEntityDefault = {
  type: Exclude<
  `${ApiMessageEntityTypes}`,
  `${ApiMessageEntityTypes.Pre}` | `${ApiMessageEntityTypes.TextUrl}` | `${ApiMessageEntityTypes.MentionName}` |
  `${ApiMessageEntityTypes.CustomEmoji}` | `${ApiMessageEntityTypes.Blockquote}`
  >;
  offset: number;
  length: number;
};

export type ApiMessageEntityPre = {
  type: ApiMessageEntityTypes.Pre;
  offset: number;
  length: number;
  language?: string;
};

export type ApiMessageEntityTextUrl = {
  type: ApiMessageEntityTypes.TextUrl;
  offset: number;
  length: number;
  url: string;
};

export type ApiMessageEntityMentionName = {
  type: ApiMessageEntityTypes.MentionName;
  offset: number;
  length: number;
  userId: string;
};

export type ApiMessageEntityBlockquote = {
  type: ApiMessageEntityTypes.Blockquote;
  offset: number;
  length: number;
  canCollapse?: boolean;
};

export type ApiMessageEntityCustomEmoji = {
  type: ApiMessageEntityTypes.CustomEmoji;
  offset: number;
  length: number;
  documentId: string;
};

export type ApiMessageEntity = ApiMessageEntityDefault | ApiMessageEntityPre | ApiMessageEntityTextUrl |
ApiMessageEntityMentionName | ApiMessageEntityCustomEmoji | ApiMessageEntityBlockquote;

export enum ApiMessageEntityTypes {
  Bold = 'MessageEntityBold',
  Blockquote = 'MessageEntityBlockquote',
  BotCommand = 'MessageEntityBotCommand',
  Cashtag = 'MessageEntityCashtag',
  Code = 'MessageEntityCode',
  Email = 'MessageEntityEmail',
  Hashtag = 'MessageEntityHashtag',
  Italic = 'MessageEntityItalic',
  MentionName = 'MessageEntityMentionName',
  Mention = 'MessageEntityMention',
  Phone = 'MessageEntityPhone',
  Pre = 'MessageEntityPre',
  Strike = 'MessageEntityStrike',
  TextUrl = 'MessageEntityTextUrl',
  Url = 'MessageEntityUrl',
  Underline = 'MessageEntityUnderline',
  Spoiler = 'MessageEntitySpoiler',
  CustomEmoji = 'MessageEntityCustomEmoji',
  Unknown = 'MessageEntityUnknown',
}

export interface ApiFormattedText {
  text: string;
  entities?: ApiMessageEntity[];
}

export type MediaContent = {
  text?: ApiFormattedText;
  photo?: ApiPhoto;
  video?: ApiVideo;
  altVideo?: ApiVideo;
  document?: ApiDocument;
  sticker?: ApiSticker;
  contact?: ApiContact;
  poll?: ApiPoll;
  action?: ApiAction;
  webPage?: ApiWebPage;
  audio?: ApiAudio;
  voice?: ApiVoice;
  invoice?: ApiInvoice;
  location?: ApiLocation;
  game?: ApiGame;
  storyData?: ApiMessageStoryData;
  giveaway?: ApiGiveaway;
  giveawayResults?: ApiGiveawayResults;
  paidMedia?: ApiPaidMedia;
  isExpiredVoice?: boolean;
  isExpiredRoundVideo?: boolean;
  ttlSeconds?: number;
};
export type MediaContainer = {
  content: MediaContent;
};

export type BoughtPaidMedia = Pick<MediaContent, 'photo' | 'video'>;

export interface ApiMessage {
  id: number;
  chatId: string;
  content: MediaContent;
  date: number;
  isOutgoing: boolean;
  senderId?: string;
  replyInfo?: ApiReplyInfo;
  sendingState?: 'messageSendingStatePending' | 'messageSendingStateFailed';
  forwardInfo?: ApiMessageForwardInfo;
  isDeleting?: boolean;
  previousLocalId?: number;
  viewsCount?: number;
  forwardsCount?: number;
  isEdited?: boolean;
  editDate?: number;
  isMentioned?: boolean;
  isMediaUnread?: boolean;
  groupedId?: string;
  isInAlbum?: boolean;
  hasUnreadMention?: boolean;
  inlineButtons?: ApiKeyboardButtons;
  keyboardButtons?: ApiKeyboardButtons;
  keyboardPlaceholder?: string;
  isKeyboardSingleUse?: boolean;
  isKeyboardSelective?: boolean;
  viaBotId?: string;
  viaBusinessBotId?: string;
  postAuthorTitle?: string;
  isScheduled?: boolean;
  shouldHideKeyboardButtons?: boolean;
  isHideKeyboardSelective?: boolean;
  isFromScheduled?: boolean;
  isSilent?: boolean;
  isPinned?: boolean;
  seenByDates?: Record<string, number>;
  isProtected?: boolean;
  isForwardingAllowed?: boolean;
  transcriptionId?: string;
  isTranscriptionError?: boolean;
  emojiOnlyCount?: number;
  reactors?: {
    nextOffset?: string;
    count: number;
    reactions: ApiPeerReaction[];
  };
  reactions?: ApiReactions;
  hasComments?: boolean;
  readDate?: number;
  savedPeerId?: string;
  senderBoosts?: number;
  factCheck?: ApiFactCheck;
  effectId?: string;
  isInvertedMedia?: true;
}

export interface ApiReactions {
  canSeeList?: boolean;
  areTags?: boolean;
  results: ApiReactionCount[];
  recentReactions?: ApiPeerReaction[];
}

export interface ApiPeerReaction {
  peerId: string;
  reaction: ApiReaction;
  isOwn?: boolean;
  isBig?: boolean;
  isUnread?: boolean;
  addedDate: number;
}

export interface ApiReactionCount {
  chosenOrder?: number;
  count: number;
  reaction: ApiReaction;
}

export interface ApiAvailableReaction {
  selectAnimation?: ApiDocument;
  appearAnimation?: ApiDocument;
  activateAnimation?: ApiDocument;
  effectAnimation?: ApiDocument;
  staticIcon?: ApiDocument;
  centerIcon?: ApiDocument;
  aroundAnimation?: ApiDocument;
  reaction: ApiReactionEmoji;
  title: string;
  isInactive?: boolean;
  isPremium?: boolean;
}

export interface ApiAvailableEffect {
  id: string;
  emoticon: string;
  staticIconId?: string;
  effectAnimationId?: string;
  effectStickerId: string;
  isPremium?: boolean;
}

type ApiChatReactionsAll = {
  type: 'all';
  areCustomAllowed?: true;
};

type ApiChatReactionsSome = {
  type: 'some';
  allowed: ApiReaction[];
};

export type ApiChatReactions = ApiChatReactionsAll | ApiChatReactionsSome;

export type ApiReactionEmoji = {
  emoticon: string;
};

export type ApiReactionCustomEmoji = {
  documentId: string;
};

export type ApiReaction = ApiReactionEmoji | ApiReactionCustomEmoji;

export type ApiReactionKey = `${string}-${string}`;

export type ApiSavedReactionTag = {
  reaction: ApiReaction;
  title?: string;
  count: number;
};

interface ApiBaseThreadInfo {
  chatId: string;
  messagesCount: number;
  lastMessageId?: number;
  lastReadInboxMessageId?: number;
  recentReplierIds?: string[];
}

export interface ApiCommentsInfo extends ApiBaseThreadInfo {
  isCommentsInfo: true;
  threadId?: ThreadId;
  originChannelId: string;
  originMessageId: number;
}

export interface ApiMessageThreadInfo extends ApiBaseThreadInfo {
  isCommentsInfo: false;
  threadId: ThreadId;
  // For linked messages in discussion
  fromChannelId?: string;
  fromMessageId?: number;
}

export type ApiThreadInfo = ApiCommentsInfo | ApiMessageThreadInfo;

export type ApiMessageOutgoingStatus = 'read' | 'succeeded' | 'pending' | 'failed';

export type ApiSponsoredMessage = {
  randomId: string;
  isRecommended?: true;
  text: ApiFormattedText;
  expiresAt: number;
  sponsorInfo?: string;
  additionalInfo?: string;
  buttonText?: string;
  canReport?: true;
  title: string;
  url: string;
  photo?: ApiPhoto;
  peerColor?: ApiPeerColor;
};

// KeyboardButtons

interface ApiKeyboardButtonSimple {
  type: 'unsupported' | 'buy' | 'command' | 'requestPhone' | 'game';
  text: string;
}

interface ApiKeyboardButtonReceipt {
  type: 'receipt';
  receiptMessageId: number;
}

interface ApiKeyboardButtonUrl {
  type: 'url';
  text: string;
  url: string;
}

interface ApiKeyboardButtonSimpleWebView {
  type: 'simpleWebView';
  text: string;
  url: string;
}

interface ApiKeyboardButtonWebView {
  type: 'webView';
  text: string;
  url: string;
}

interface ApiKeyboardButtonCallback {
  type: 'callback';
  text: string;
  data: string;
}

interface ApiKeyboardButtonRequestPoll {
  type: 'requestPoll';
  text: string;
  isQuiz?: boolean;
}

interface ApiKeyboardButtonSwitchBotInline {
  type: 'switchBotInline';
  text: string;
  query: string;
  isSamePeer?: boolean;
}

interface ApiKeyboardButtonUserProfile {
  type: 'userProfile';
  text: string;
  userId: string;
}

interface ApiKeyboardButtonUrlAuth {
  type: 'urlAuth';
  text: string;
  url: string;
  buttonId: number;
}

export type ApiTranscription = {
  text: string;
  isPending?: boolean;
  transcriptionId: string;
};

export type ApiKeyboardButton = (
  ApiKeyboardButtonSimple
  | ApiKeyboardButtonReceipt
  | ApiKeyboardButtonUrl
  | ApiKeyboardButtonCallback
  | ApiKeyboardButtonRequestPoll
  | ApiKeyboardButtonSwitchBotInline
  | ApiKeyboardButtonUserProfile
  | ApiKeyboardButtonWebView
  | ApiKeyboardButtonSimpleWebView
  | ApiKeyboardButtonUrlAuth
);

export type ApiKeyboardButtons = ApiKeyboardButton[][];
export type ApiReplyKeyboard = {
  keyboardPlaceholder?: string;
  isKeyboardSingleUse?: boolean;
  isKeyboardSelective?: boolean;
} & {
  [K in 'inlineButtons' | 'keyboardButtons']?: ApiKeyboardButtons;
};

export type ApiMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'voice' | 'profilePhoto';
export type ApiGlobalMessageSearchType = 'text' | 'channels' | 'media' | 'documents' | 'links' | 'audio' | 'voice';

export type ApiReportReason = 'spam' | 'violence' | 'pornography' | 'childAbuse'
| 'copyright' | 'geoIrrelevant' | 'fake' | 'illegalDrugs' | 'personalDetails' | 'other';

export type ApiSendMessageAction = {
  type: 'cancel' | 'typing' | 'recordAudio' | 'chooseSticker' | 'playingGame';
};

export type ApiThemeParameters = {
  bg_color: string;
  text_color: string;
  hint_color: string;
  link_color: string;
  button_color: string;
  button_text_color: string;
  secondary_bg_color: string;
  header_bg_color: string;
  accent_text_color: string;
  section_bg_color: string;
  section_header_text_color: string;
  subtitle_text_color: string;
  destructive_text_color: string;
  section_separator_color: string;
};

export type ApiBotApp = {
  id: string;
  accessHash: string;
  title: string;
  shortName: string;
  description: string;
  photo?: ApiPhoto;
  document?: ApiDocument;
};

export type ApiMessagesBotApp = ApiBotApp & {
  isInactive?: boolean;
  shouldRequestWriteAccess?: boolean;
};

export type ApiQuickReply = {
  id: number;
  shortcut: string;
  topMessageId: number;
};

export type ApiFactCheck = {
  shouldFetch?: true;
  hash: string;
  countryCode?: string;
  text?: ApiFormattedText;
};

export type ApiSponsoredMessageReportResult = {
  type: 'reported' | 'hidden' | 'premiumRequired';
} | {
  type: 'selectOption';
  title: string;
  options: {
    text: string;
    option: string;
  }[];
};

export const MAIN_THREAD_ID = -1;

// `Symbol` can not be transferred from worker
export const MESSAGE_DELETED = 'MESSAGE_DELETED';
