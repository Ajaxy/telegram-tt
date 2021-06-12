import {
  ApiChat,
  ApiChatFullInfo,
  ApiTypingStatus,
  ApiChatMember,
  ApiChatFolder,
} from './chats';
import {
  ApiMessage, ApiPhoto, ApiPoll, ApiStickerSet, ApiThreadInfo,
} from './messages';
import { ApiUser, ApiUserFullInfo, ApiUserStatus } from './users';

export type ApiUpdateReady = {
  '@type': 'updateApiReady';
};

export type ApiUpdateAuthorizationStateType = (
  'authorizationStateLoggingOut' |
  'authorizationStateWaitPhoneNumber' |
  'authorizationStateWaitCode' |
  'authorizationStateWaitPassword' |
  'authorizationStateWaitRegistration' |
  'authorizationStateReady' |
  'authorizationStateClosing' |
  'authorizationStateClosed' |
  'authorizationStateWaitQrCode'
);

export type ApiUpdateConnectionStateType = (
  'connectionStateConnecting' |
  'connectionStateReady' |
  'connectionStateBroken'
);

export type ApiUpdateAuthorizationState = {
  '@type': 'updateAuthorizationState';
  authorizationState: ApiUpdateAuthorizationStateType;
  sessionId?: string;
  sessionJson?: string;
  isCodeViaApp?: boolean;
  hint?: string;
  qrCode?: { token: string; expires: number };
};

export type ApiUpdateAuthorizationError = {
  '@type': 'updateAuthorizationError';
  message: string;
};

export type ApiUpdateConnectionState = {
  '@type': 'updateConnectionState';
  connectionState: ApiUpdateConnectionStateType;
};

export type ApiUpdateCurrentUser = {
  '@type': 'updateCurrentUser';
  currentUser: ApiUser;
};

export type ApiUpdateChat = {
  '@type': 'updateChat';
  id: number;
  chat: Partial<ApiChat>;
  newProfilePhoto?: ApiPhoto;
  noTopChatsRequest?: boolean;
};

export type ApiUpdateChatJoin = {
  '@type': 'updateChatJoin';
  id: number;
};

export type ApiUpdateChatLeave = {
  '@type': 'updateChatLeave';
  id: number;
};

export type ApiUpdateChatInbox = {
  '@type': 'updateChatInbox';
  id: number;
  chat: Partial<ApiChat>;
};

export type ApiUpdateChatTypingStatus = {
  '@type': 'updateChatTypingStatus';
  id: number;
  typingStatus: ApiTypingStatus | undefined;
};

export type ApiUpdateChatFullInfo = {
  '@type': 'updateChatFullInfo';
  id: number;
  fullInfo: Partial<ApiChatFullInfo>;
};

export type ApiUpdateChatMembers = {
  '@type': 'updateChatMembers';
  id: number;
  replacedMembers?: ApiChatMember[];
  addedMember?: ApiChatMember;
  deletedMemberId?: number;
};

export type ApiUpdatePinnedChatIds = {
  '@type': 'updatePinnedChatIds';
  ids: number[];
  folderId?: number;
};

export type ApiUpdateChatListType = {
  '@type': 'updateChatListType';
  id: number;
  folderId: number;
};

export type ApiUpdateChatPinned = {
  '@type': 'updateChatPinned';
  id: number;
  isPinned: boolean;
};

export type ApiUpdateChatFolder = {
  '@type': 'updateChatFolder';
  id: number;
  folder: ApiChatFolder | undefined;
};

export type ApiUpdateChatFoldersOrder = {
  '@type': 'updateChatFoldersOrder';
  orderedIds: number[];
};

export type ApiUpdateRecommendedChatFolders = {
  '@type': 'updateRecommendedChatFolders';
  folders: ApiChatFolder[];
};

export type ApiUpdateNewScheduledMessage = {
  '@type': 'newScheduledMessage';
  chatId: number;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdateNewMessage = {
  '@type': 'newMessage';
  chatId: number;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdateMessage = {
  '@type': 'updateMessage';
  chatId: number;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdateScheduledMessage = {
  '@type': 'updateScheduledMessage';
  chatId: number;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdatePinnedMessageIds = {
  '@type': 'updatePinnedIds';
  chatId: number;
  isPinned?: boolean;
  messageIds: number[];
};

export type ApiUpdateThreadInfo = {
  '@type': 'updateThreadInfo';
  chatId: number;
  threadId: number;
  threadInfo: Partial<ApiThreadInfo>;
  firstMessageId?: number;
};

export type ApiUpdateScheduledMessageSendSucceeded = {
  '@type': 'updateScheduledMessageSendSucceeded';
  chatId: number;
  localId: number;
  message: ApiMessage;
};

export type ApiUpdateMessageSendSucceeded = {
  '@type': 'updateMessageSendSucceeded';
  chatId: number;
  localId: number;
  message: ApiMessage;
};

export type ApiUpdateMessageSendFailed = {
  '@type': 'updateMessageSendFailed';
  chatId: number;
  localId: number;
  sendingState: {
    '@type': 'messageSendingStateFailed';
  };
};

export type ApiUpdateCommonBoxMessages = {
  '@type': 'updateCommonBoxMessages';
  ids: number[];
  messageUpdate: Partial<ApiMessage>;
};

export type ApiUpdateChannelMessages = {
  '@type': 'updateChannelMessages';
  channelId: number;
  ids: number[];
  messageUpdate: Partial<ApiMessage>;
};

export type ApiUpdateMessagePoll = {
  '@type': 'updateMessagePoll';
  pollId: string;
  pollUpdate: Partial<ApiPoll>;
};

export type ApiUpdateMessagePollVote = {
  '@type': 'updateMessagePollVote';
  pollId: string;
  userId: number;
  options: string[];
};

export type ApiUpdateDeleteMessages = {
  '@type': 'deleteMessages';
  ids: number[];
  chatId?: number;
};

export type ApiUpdateDeleteScheduledMessages = {
  '@type': 'deleteScheduledMessages';
  ids: number[];
  chatId?: number;
};

export type ApiUpdateDeleteHistory = {
  '@type': 'deleteHistory';
  chatId: number;
};

export type ApiUpdateDeleteProfilePhotos = {
  '@type': 'deleteProfilePhotos';
  ids: string[];
  chatId: number;
};

export type ApiUpdateResetMessages = {
  '@type': 'resetMessages';
  id: number;
};

export type ApiDeleteUser = {
  '@type': 'deleteUser';
  id: number;
};

export type ApiUpdateUser = {
  '@type': 'updateUser';
  id: number;
  user: Partial<ApiUser>;
};

export type ApiUpdateUserStatus = {
  '@type': 'updateUserStatus';
  userId: number;
  status: ApiUserStatus;
};

export type ApiUpdateUserFullInfo = {
  '@type': 'updateUserFullInfo';
  id: number;
  fullInfo: Partial<ApiUserFullInfo>;
};

export type ApiUpdateAvatar = {
  '@type': 'updateAvatar';
  chatId: number;
  dataUri: string;
};

export type ApiUpdateMessageImage = {
  '@type': 'updateMessageImage';
  messageId: number;
  dataUri: string;
};

export type ApiNotification = {
  message: string;
};

export type ApiError = {
  message: string;
  isSlowMode?: boolean;
  textParams?: Record<string, string>;
};

export type ApiUpdateError = {
  '@type': 'error';
  error: ApiError;
};

export type ApiUpdateResetContacts = {
  '@type': 'updateResetContactList';
};

export type ApiUpdateFavoriteStickers = {
  '@type': 'updateFavoriteStickers';
};

export type ApiUpdateStickerSet = {
  '@type': 'updateStickerSet';
  id: string;
  stickerSet: Partial<ApiStickerSet>;
};

export type ApiUpdateTwoFaError = {
  '@type': 'updateTwoFaError';
  message: string;
};

export type ApiUpdateNotifySettings = {
  '@type': 'updateNotifySettings';
  peerType: 'contact' | 'group' | 'broadcast';
  isSilent: boolean;
  shouldShowPreviews: boolean;
};

export type ApiUpdateNotifyExceptions = {
  '@type': 'updateNotifyExceptions';
  id: number;
  isMuted: boolean;
  isSilent?: boolean;
  shouldShowPreviews?: boolean;
};

export type updateTwoFaStateWaitCode = {
  '@type': 'updateTwoFaStateWaitCode';
  length: number;
};

export type ApiUpdatePeerBlocked = {
  '@type': 'updatePeerBlocked';
  id: number;
  isBlocked: boolean;
};

export type ApiUpdatePrivacy = {
  '@type': 'updatePrivacy';
  key: 'phoneNumber' | 'lastSeen' | 'profilePhoto' | 'forwards' | 'chatInvite';
  rules: {
    visibility: 'everybody' | 'contacts' | 'nonContacts' | 'nobody';
    allowUserIds: number[];
    allowChatIds: number[];
    blockUserIds: number[];
    blockChatIds: number[];
  };
};

export type ApiUpdate = (
  ApiUpdateReady |
  ApiUpdateAuthorizationState | ApiUpdateAuthorizationError | ApiUpdateConnectionState | ApiUpdateCurrentUser |
  ApiUpdateChat | ApiUpdateChatInbox | ApiUpdateChatTypingStatus | ApiUpdateChatFullInfo | ApiUpdatePinnedChatIds |
  ApiUpdateChatMembers | ApiUpdateChatJoin | ApiUpdateChatLeave | ApiUpdateChatPinned | ApiUpdatePinnedMessageIds |
  ApiUpdateChatListType | ApiUpdateChatFolder | ApiUpdateChatFoldersOrder | ApiUpdateRecommendedChatFolders |
  ApiUpdateNewMessage | ApiUpdateMessage | ApiUpdateThreadInfo | ApiUpdateCommonBoxMessages | ApiUpdateChannelMessages |
  ApiUpdateDeleteMessages | ApiUpdateMessagePoll | ApiUpdateMessagePollVote | ApiUpdateDeleteHistory |
  ApiUpdateMessageSendSucceeded | ApiUpdateMessageSendFailed |
  ApiDeleteUser | ApiUpdateUser | ApiUpdateUserStatus | ApiUpdateUserFullInfo | ApiUpdateDeleteProfilePhotos |
  ApiUpdateAvatar | ApiUpdateMessageImage |
  ApiUpdateError | ApiUpdateResetContacts |
  ApiUpdateFavoriteStickers | ApiUpdateStickerSet |
  ApiUpdateNewScheduledMessage | ApiUpdateScheduledMessageSendSucceeded | ApiUpdateScheduledMessage |
  ApiUpdateDeleteScheduledMessages | ApiUpdateResetMessages |
  ApiUpdateTwoFaError | updateTwoFaStateWaitCode |
  ApiUpdateNotifySettings | ApiUpdateNotifyExceptions | ApiUpdatePeerBlocked | ApiUpdatePrivacy
);

export type OnApiUpdate = (update: ApiUpdate) => void;
