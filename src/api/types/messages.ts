export interface ApiPhotoSize {
  type: 's' | 'm' | 'x' | 'y' | 'z';
  width: number;
  height: number;
}

export interface ApiThumbnail {
  dataUri: string;
  height: number;
  width: number;
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
  stickerSetAccessHash: string;
  emoji: string;
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
  hash: number;
  stickers?: ApiSticker[];
  packs?: Record<string, ApiSticker[]>;
  covers?: ApiSticker[];
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
}

export interface ApiContact {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  userId: number;
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
    recentVoterIds?: number[];
    solution?: string;
    solutionEntities?: ApiMessageEntity[];
  };
}

export interface ApiInvoice {
  text: string;
  title: string;
  photoUrl?: string;
  description?: string;
  receiptMsgId?: number;
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
  targetUserId?: number;
  targetChatId?: number;
  type: 'historyClear' | 'other';
  photo?: ApiPhoto;
}

export interface ApiWebPage {
  id: number;
  url: string;
  displayUrl: string;
  siteName?: string;
  title?: string;
  description?: string;
  photo?: ApiPhoto;
  hasDocument?: true;
}

export interface ApiMessageForwardInfo {
  isChannelPost: boolean;
  isLinkedChannelPost?: boolean;
  fromChatId?: number;
  senderUserId?: number;
  fromMessageId?: number;
  hiddenUserName?: string;
  adminTitle?: string;
}

export interface ApiMessageEntity {
  type: string;
  offset: number;
  length: number;
  userId?: number;
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
  chatId: number;
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
  senderId?: number;
  replyToMessageId?: number;
  replyToTopMessageId?: number;
  sendingState?: 'messageSendingStatePending' | 'messageSendingStateFailed';
  forwardInfo?: ApiMessageForwardInfo;
  isDeleting?: boolean;
  previousLocalId?: number;
  views?: number;
  isEdited?: boolean;
  isMediaUnread?: boolean;
  groupedId?: string;
  isInAlbum?: boolean;
  hasUnreadMention?: boolean;
  inlineButtons?: ApiKeyboardButtons;
  keyboardButtons?: ApiKeyboardButtons;
  viaBotId?: number;
  threadInfo?: ApiThreadInfo;
  adminTitle?: string;
  isScheduled?: boolean;
  shouldHideKeyboardButtons?: boolean;
  isFromScheduled?: boolean;
}

export interface ApiThreadInfo {
  threadId: number;
  chatId: number;
  topMessageId?: number;
  originChannelId?: number;
  messagesCount: number;
  lastMessageId?: number;
  lastReadInboxMessageId?: number;
  recentReplierIds?: number[];
}

export type ApiMessageOutgoingStatus = 'read' | 'succeeded' | 'pending' | 'failed';

export interface ApiKeyboardButton {
  type: 'command' | 'url' | 'callback' | 'requestPoll' | 'buy' | 'NOT_SUPPORTED';
  text: string;
  messageId: number;
  value?: string;
}

export type ApiKeyboardButtons = ApiKeyboardButton[][];

export type ApiMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'profilePhoto';
export type ApiGlobalMessageSearchType = 'text' | 'media' | 'documents' | 'links' | 'audio' | 'voice';

export const MAIN_THREAD_ID = -1;

// `Symbol` can not be transferred from worker
export const MESSAGE_DELETED = 'MESSAGE_DELETED';
