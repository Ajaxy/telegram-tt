import { ApiGroupCall } from './calls';

export interface ApiDimensions {
  width: number;
  height: number;
}

export interface ApiPhotoSize extends ApiDimensions {
  type: 's' | 'm' | 'x' | 'y' | 'z';
}

export interface ApiThumbnail extends ApiDimensions {
  dataUri: string;
}

export interface ApiPhoto {
  id: string;
  thumbnail?: ApiThumbnail;
  sizes: ApiPhotoSize[];
  blobUrl?: string;
}

export interface ApiSticker {
  id: string;
  stickerSetId: string;
  stickerSetAccessHash?: string;
  emoji?: string;
  isAnimated: boolean;
  width?: number;
  height?: number;
  thumbnail?: ApiThumbnail;
  isPreloadedGlobally?: boolean;
}

export interface ApiStickerSet {
  archived?: true;
  isAnimated?: true;
  installedDate?: number;
  id: string;
  accessHash: string;
  title: string;
  hasThumbnail?: boolean;
  count: number;
  stickers?: ApiSticker[];
  packs?: Record<string, ApiSticker[]>;
  covers?: ApiSticker[];
  shortName: string;
}

export interface ApiVideo {
  id: string;
  mimeType: string;
  duration: number;
  fileName: string;
  width?: number;
  height?: number;
  supportsStreaming?: boolean;
  isRound?: boolean;
  isGif?: boolean;
  thumbnail?: ApiThumbnail;
  blobUrl?: string;
  size: number;
}

export interface ApiAudio {
  size: number;
  mimeType: string;
  fileName: string;
  duration: number;
  performer?: string;
  title?: string;
  thumbnailSizes?: ApiPhotoSize[];
}

export interface ApiVoice {
  duration: number;
  waveform?: number[];
}

export interface ApiDocument {
  id?: string;
  fileName: string;
  size: number;
  timestamp?: number;
  mimeType: string;
  thumbnail?: ApiThumbnail;
  previewBlobUrl?: string;
  mediaType?: 'photo' | 'video';
  mediaSize?: ApiDimensions;
}

export interface ApiContact {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userId: string;
}

export interface ApiPollAnswer {
  text: string;
  option: string;
}

export interface ApiPollResult {
  isChosen?: true;
  isCorrect?: true;
  option: string;
  votersCount: number;
}

export interface ApiPoll {
  id: string;
  summary: {
    closed?: true;
    isPublic?: true;
    multipleChoice?: true;
    quiz?: true;
    question: string;
    answers: ApiPollAnswer[];
    closePeriod?: number;
    closeDate?: number;
  };
  results: {
    results?: ApiPollResult[];
    totalVoters?: number;
    recentVoterIds?: string[];
    solution?: string;
    solutionEntities?: ApiMessageEntity[];
  };
}

export interface ApiInvoice {
  text: string;
  title: string;
  photoUrl?: string;
  amount: number;
  currency: string;
  receiptMsgId?: number;
  isTest?: boolean;
}

export type ApiNewPoll = {
  summary: ApiPoll['summary'];
  quiz?: {
    correctAnswers: string[];
    solution?: string;
    solutionEntities?: ApiMessageEntity[];
  };
};

export interface ApiAction {
  text: string;
  targetUserIds?: string[];
  targetChatId?: string;
  type: 'historyClear' | 'contactSignUp' | 'chatCreate' | 'other';
  photo?: ApiPhoto;
  amount?: number;
  currency?: string;
  translationValues: string[];
  call?: Partial<ApiGroupCall>;
}

export interface ApiWebPage {
  id: number;
  url: string;
  displayUrl: string;
  type?: string;
  siteName?: string;
  title?: string;
  description?: string;
  photo?: ApiPhoto;
  duration?: number;
  document?: ApiDocument;
  video?: ApiVideo;
}

export interface ApiMessageForwardInfo {
  date: number;
  isChannelPost: boolean;
  channelPostId?: number;
  isLinkedChannelPost?: boolean;
  fromChatId?: string;
  senderUserId?: string;
  fromMessageId?: number;
  hiddenUserName?: string;
  adminTitle?: string;
}

export interface ApiMessageEntity {
  type: string;
  offset: number;
  length: number;
  userId?: string;
  url?: string;
}

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
  Unknown = 'MessageEntityUnknown',
}

export interface ApiFormattedText {
  text: string;
  entities?: ApiMessageEntity[];
}

export interface ApiMessage {
  id: number;
  chatId: string;
  content: {
    text?: ApiFormattedText;
    photo?: ApiPhoto;
    video?: ApiVideo;
    document?: ApiDocument;
    sticker?: ApiSticker;
    contact?: ApiContact;
    poll?: ApiPoll;
    action?: ApiAction;
    webPage?: ApiWebPage;
    audio?: ApiAudio;
    voice?: ApiVoice;
    invoice?: ApiInvoice;
  };
  date: number;
  isOutgoing: boolean;
  senderId?: string;
  replyToChatId?: string;
  replyToMessageId?: number;
  replyToTopMessageId?: number;
  sendingState?: 'messageSendingStatePending' | 'messageSendingStateFailed';
  forwardInfo?: ApiMessageForwardInfo;
  isDeleting?: boolean;
  previousLocalId?: number;
  views?: number;
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
  viaBotId?: string;
  threadInfo?: ApiThreadInfo;
  adminTitle?: string;
  isScheduled?: boolean;
  shouldHideKeyboardButtons?: boolean;
  isFromScheduled?: boolean;
  seenByUserIds?: string[];
  isProtected?: boolean;
}

export interface ApiThreadInfo {
  threadId: number;
  chatId: string;
  topMessageId?: number;
  originChannelId?: string;
  messagesCount: number;
  lastMessageId?: number;
  lastReadInboxMessageId?: number;
  recentReplierIds?: string[];
}

export type ApiMessageOutgoingStatus = 'read' | 'succeeded' | 'pending' | 'failed';

export type ApiSponsoredMessage = {
  chatId?: string;
  randomId: string;
  isBot?: boolean;
  channelPostId?: number;
  startParam?: string;
  chatInviteHash?: string;
  chatInviteTitle?: string;
  text: ApiFormattedText;
  expiresAt: number;
};

export interface ApiKeyboardButton {
  type: 'command' | 'url' | 'callback' | 'requestPoll' | 'buy' | 'NOT_SUPPORTED';
  text: string;
  messageId: number;
  value?: string;
}

export type ApiKeyboardButtons = ApiKeyboardButton[][];
export type ApiReplyKeyboard = {
  keyboardPlaceholder?: string;
  isKeyboardSingleUse?: boolean;
} & {
  [K in 'inlineButtons' | 'keyboardButtons']?: ApiKeyboardButtons;
};

export type ApiMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'voice' | 'profilePhoto';
export type ApiGlobalMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'voice';

export type ApiReportReason = 'spam' | 'violence' | 'pornography' | 'childAbuse'
| 'copyright' | 'geoIrrelevant' | 'fake' | 'other';

export type ApiSendMessageAction = {
  type: 'cancel' | 'typing' | 'recordAudio' | 'chooseSticker';
};

export const MAIN_THREAD_ID = -1;

// `Symbol` can not be transferred from worker
export const MESSAGE_DELETED = 'MESSAGE_DELETED';
