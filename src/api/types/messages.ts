import type { ThreadId, WebPageMediaSize } from '../../types';
import type {
  ApiBotInlineMediaResult,
  ApiBotInlineResult,
  ApiWebDocument,
} from './bots';
import type { ApiMessageAction } from './messageActions';
import type { ApiPeerNotifySettings, ApiRestrictionReason } from './misc';
import type {
  ApiLabeledPrice,
} from './payments';
import type { ApiTypePeerColor } from './peers';
import type { ApiStarGiftRegular, ApiStarGiftUnique, ApiTypeCurrencyAmount } from './stars';
import type {
  ApiMessageStoryData, ApiStory, ApiWebPageStickerData, ApiWebPageStoryData,
} from './stories';
import type { ApiInlineQueryPeerType } from './users';

export interface ApiDimensions {
  width: number;
  height: number;
}

export interface ApiPhotoSize extends ApiDimensions {
  type: 's' | 'm' | 'x' | 'y' | 'w';
}

export interface ApiVideoSize extends ApiDimensions {
  type: 'u' | 'v';
  videoStartTs?: number;
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
  previewPhotoSizes?: ApiPhotoSize[];
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

export interface StoryboardInfo {
  storyboardFile: ApiDocument;
  storyboardMapFile: ApiDocument;
  frameSize: ApiDimensions;
}

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
  previewPhotoSizes?: ApiPhotoSize[];
  blobUrl?: string;
  previewBlobUrl?: string;
  size: number;
  noSound?: boolean;
  waveform?: number[];
  timestamp?: number;
  altVideos?: ApiVideo[];
  storyboardInfo?: StoryboardInfo;
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
  previewPhotoSizes?: ApiPhotoSize[];
  previewBlobUrl?: string;
  innerMediaType?: 'photo' | 'video';
  mediaSize?: ApiDimensions & { fromDocumentAttribute?: boolean; fromPreload?: true };
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

export interface ApiInvoice {
  prices: ApiLabeledPrice[];
  totalAmount: number;
  currency: string;
  isTest?: boolean;
  isRecurring?: boolean;
  subscriptionPeriod?: number;
  termsUrl?: string;
  maxTipAmount?: number;
  suggestedTipAmounts?: number[];
  isNameRequested?: boolean;
  isPhoneRequested?: boolean;
  isEmailRequested?: boolean;
  isShippingAddressRequested?: boolean;
  isFlexible?: boolean;
  isPhoneSentToProvider?: boolean;
  isEmailSentToProvider?: boolean;
}

export interface ApiMediaInvoice {
  mediaType: 'invoice';
  title: string;
  description: string;
  photo?: ApiWebDocument;
  isTest?: boolean;
  receiptMessageId?: number;
  currency: string;
  amount: number;
  extendedMedia?: ApiMediaExtendedPreview;
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

export interface ApiGeo {
  mediaType: 'geo';
  geo: ApiGeoPoint;
}

export interface ApiVenue {
  mediaType: 'venue';
  geo: ApiGeoPoint;
  title: string;
  address: string;
  provider: string;
  venueId: string;
  venueType: string;
}

export interface ApiGeoLive {
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

export type ApiDice = {
  mediaType: 'dice';
  value: number;
  emoticon: string;
};

export type ApiGiveaway = {
  mediaType: 'giveaway';
  quantity: number;
  months?: number;
  stars?: number;
  untilDate: number;
  isOnlyForNewSubscribers?: true;
  countries?: string[];
  channelIds: string[];
  prizeDescription?: string;
};

export type ApiGiveawayResults = {
  mediaType: 'giveawayResults';
  months?: number;
  stars?: number;
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

export interface ApiTodoItem {
  id: number;
  title: ApiFormattedText;
}

export interface ApiTodoList {
  title: ApiFormattedText;
  items: ApiTodoItem[];
  othersCanAppend?: boolean;
  othersCanComplete?: boolean;
}

export interface ApiTodoCompletion {
  itemId: number;
  completedBy: string;
  completedAt: number;
}

export interface ApiMediaTodo {
  mediaType: 'todo';
  todo: ApiTodoList;
  completions?: ApiTodoCompletion[];
}

export type ApiNewMediaTodo = {
  todo: ApiTodoList;
};

export interface ApiWebPagePending {
  mediaType: 'webpage';
  webpageType: 'pending';
  id: string;
  url?: string;
  isSafe?: true;
}

export interface ApiWebPageEmpty {
  mediaType: 'webpage';
  webpageType: 'empty';
  id: string;
  url?: string;
  isSafe?: true;
}

export interface ApiWebPageFull {
  mediaType: 'webpage';
  webpageType: 'full';
  id: string;
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
  gift?: ApiStarGiftUnique;
  auction?: ApiWebPageAuctionData;
  stickers?: ApiWebPageStickerData;
  hasLargeMedia?: boolean;
}

export type ApiWebPageAuctionData = {
  gift: ApiStarGiftRegular;
  endDate: number;
};

export type ApiWebPage = ApiWebPagePending | ApiWebPageEmpty | ApiWebPageFull;

/**
 * Wrapper with message-specific fields
 */
export interface ApiMessageWebPage {
  id: string;
  isSafe?: true;
  mediaSize?: WebPageMediaSize;
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
  quoteOffset?: number;
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
  monoforumPeerId?: string;
  quoteText?: ApiFormattedText;
  quoteOffset?: number;
}

export interface ApiSuggestedPost {
  isAccepted?: true;
  isRejected?: true;
  price?: ApiTypeCurrencyAmount;
  scheduleDate?: number;
}

export interface ApiInputStoryReplyInfo {
  type: 'story';
  peerId: string;
  storyId: number;
}

export interface ApiInputSuggestedPostInfo {
  price?: ApiTypeCurrencyAmount;
  scheduleDate?: number;
  isAccepted?: true;
  isRejected?: true;
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
  isSavedOutgoing?: boolean;
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
  `${ApiMessageEntityTypes.Blockquote}` | `${ApiMessageEntityTypes.CustomEmoji}` | `${ApiMessageEntityTypes.Timestamp}`
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

// Local entities
export type ApiMessageEntityTimestamp = {
  type: ApiMessageEntityTypes.Timestamp;
  offset: number;
  length: number;
  timestamp: number;
};

export type ApiMessageEntity = ApiMessageEntityDefault | ApiMessageEntityPre | ApiMessageEntityTextUrl |
  ApiMessageEntityMentionName | ApiMessageEntityCustomEmoji | ApiMessageEntityBlockquote | ApiMessageEntityTimestamp;

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
  Timestamp = 'MessageEntityTimestamp',
  QuoteFocus = 'MessageEntityQuoteFocus',
  Unknown = 'MessageEntityUnknown',
}

export interface ApiFormattedText {
  text: string;
  entities?: ApiMessageEntity[];
}

export interface ApiFormattedTextWithEmojiOnlyCount extends ApiFormattedText {
  emojiOnlyCount?: number;
}

export type MediaContent = {
  text?: ApiFormattedTextWithEmojiOnlyCount;
  photo?: ApiPhoto;
  video?: ApiVideo;
  document?: ApiDocument;
  sticker?: ApiSticker;
  contact?: ApiContact;
  pollId?: string;
  todo?: ApiMediaTodo;
  action?: ApiMessageAction;
  webPage?: ApiMessageWebPage;
  audio?: ApiAudio;
  voice?: ApiVoice;
  invoice?: ApiMediaInvoice;
  location?: ApiLocation;
  game?: ApiGame;
  storyData?: ApiMessageStoryData;
  giveaway?: ApiGiveaway;
  giveawayResults?: ApiGiveawayResults;
  paidMedia?: ApiPaidMedia;
  dice?: ApiDice;
  ttlSeconds?: number;
};
export type MediaContainer = {
  content: MediaContent;
};

export type StatefulMediaContent = {
  poll?: ApiPoll;
  story?: ApiStory;
  webPage?: ApiWebPage;
};

export type SizeTarget =
  'micro'
  | 'pictogram'
  | 'inline'
  | 'preview'
  | 'full'
  | 'download';

export type BoughtPaidMedia = Pick<MediaContent, 'photo' | 'video'>;

export interface ApiMessage {
  id: number;
  chatId: string;
  content: MediaContent;
  date: number;
  isOutgoing: boolean;
  senderId?: string;
  replyInfo?: ApiReplyInfo;
  suggestedPostInfo?: ApiInputSuggestedPostInfo;
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
  scheduleRepeatPeriod?: number;
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
  isVideoProcessingPending?: true;
  areReactionsPossible?: true;
  reportDeliveryUntilDate?: number;
  paidMessageStars?: number;
  restrictionReasons?: ApiRestrictionReason[];
  summaryLanguageCode?: string;

  isTypingDraft?: boolean; // Local field
}

export interface ApiReactions {
  canSeeList?: boolean;
  areTags?: boolean;
  results: ApiReactionCount[];
  recentReactions?: ApiPeerReaction[];
  topReactors?: ApiMessageReactor[];
}

export interface ApiPeerReaction {
  peerId: string;
  reaction: ApiReaction;
  isOwn?: boolean;
  isBig?: boolean;
  isUnread?: boolean;
  addedDate: number;
}

export interface ApiMessageReactor {
  isTop?: true;
  isMy?: true;
  count: number;
  isAnonymous?: true;
  peerId?: string;
}

export interface ApiReactionCount {
  chosenOrder?: number;
  count: number;
  reaction: ApiReactionWithPaid;
  localAmount?: number;
  localIsPrivate?: boolean;
  localPeerId?: string;
  localPreviousChosenOrder?: number;
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
  type: 'emoji';
  emoticon: string;
};

export type ApiReactionCustomEmoji = {
  type: 'custom';
  documentId: string;
};

export type ApiReactionPaid = {
  type: 'paid';
};

export type ApiReaction = ApiReactionEmoji | ApiReactionCustomEmoji;
export type ApiReactionWithPaid = ApiReaction | ApiReactionPaid;

export type ApiReactionKey = `${string}-${string}` | 'paid' | 'unsupported';

export type ApiSavedReactionTag = {
  reaction: ApiReaction;
  title?: string;
  count: number;
};

export type ApiPaidReactionPrivacyType = ApiPaidReactionPrivacyDefault |
  ApiPaidReactionPrivacyAnonymous | PaidReactionPrivacyPeer;

export type ApiPaidReactionPrivacyDefault = {
  type: 'default';
};

export type ApiPaidReactionPrivacyAnonymous = {
  type: 'anonymous';
};

export type PaidReactionPrivacyPeer = {
  type: 'peer';
  peerId: string;
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
  threadId?: never;
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

export type ApiMessageReportResult = {
  type: 'reported';
} | {
  type: 'comment';
  isOptional?: boolean;
  option: string;
} | {
  type: 'selectOption';
  title: string;
  options: {
    text: string;
    option: string;
  }[];
};

export type ApiMessageOutgoingStatus = 'read' | 'succeeded' | 'pending' | 'failed';

export type ApiSponsoredMessage = {
  chatId: string;
  randomId: string;
  isRecommended?: true;
  expiresAt: number;
  sponsorInfo?: string;
  additionalInfo?: string;
  buttonText?: string;
  canReport?: true;
  title: string;
  url: string;
  photo?: ApiPhoto;
  content: MediaContent;
  peerColor?: ApiTypePeerColor;
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

interface ApiKeyboardButtonCopy {
  type: 'copy';
  text: string;
  copyText: string;
}

export interface KeyboardButtonSuggestedMessage {
  type: 'suggestedMessage';
  text: string;
  buttonType: 'approve' | 'decline' | 'suggestChanges';
  disabled?: boolean;
}

export interface KeyboardButtonOpenThread {
  type: 'openThread';
  text: string;
}

export interface KeyboardButtonGiftOffer {
  type: 'giftOffer';
  text: string;
  buttonType: 'accept' | 'reject';
}

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
  | ApiKeyboardButtonCopy
  | KeyboardButtonSuggestedMessage
  | KeyboardButtonOpenThread
  | KeyboardButtonGiftOffer
);

export type ApiKeyboardButtons = ApiKeyboardButton[][];
export type ApiReplyKeyboard = {
  keyboardPlaceholder?: string;
  isKeyboardSingleUse?: boolean;
  isKeyboardSelective?: boolean;
} & Partial<Record<'inlineButtons' | 'keyboardButtons', ApiKeyboardButtons>>;

export type ApiTranscription = {
  text: string;
  isPending?: boolean;
  transcriptionId: string;
};

export type ApiMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'voice' | 'gif'
  | 'profilePhoto';
export type ApiGlobalMessageSearchType = 'text' |
  'channels' | 'media' | 'documents' | 'links' | 'audio' | 'voice' | 'publicPosts';
export type ApiMessageSearchContext = 'all' | 'users' | 'groups' | 'channels';

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

export type ApiPreparedInlineMessage = {
  queryId: string;
  result: ApiBotInlineResult | ApiBotInlineMediaResult;
  peerTypes: ApiInlineQueryPeerType[];
  cacheTime: number;
};

export type ApiSearchPostsFlood = {
  query?: string;
  queryIsFree?: boolean;
  totalDaily: number;
  remains: number;
  waitTill?: number;
  starsAmount: number;
};

export type LinkContext = {
  type: 'message';
  threadId?: ThreadId;
  chatId: string;
  messageId: number;
};

export interface ApiTopic {
  id: number;
  isClosed?: boolean;
  isPinned?: boolean;
  isHidden?: boolean;
  isOwner?: boolean;

  // TODO[forums] https://github.com/telegramdesktop/tdesktop/blob/1aece79a471d99a8b63d826b1bce1f36a04d7293/Telegram/SourceFiles/data/data_forum_topic.cpp#L318
  isMin?: boolean;
  date: number;
  title: string;
  iconColor: number;
  iconEmojiId?: string;
  lastMessageId: number;
  unreadCount: number;
  unreadMentionsCount: number;
  unreadReactionsCount: number;
  fromId: string;
  notifySettings: ApiPeerNotifySettings;
  isTitleMissing?: boolean;
}

export const MAIN_THREAD_ID = -1;

// `Symbol` can not be transferred from worker
export const MESSAGE_DELETED = 'MESSAGE_DELETED';
