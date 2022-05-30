import type {
  GroupCallConnectionData,
  GroupCallParticipant,
  GroupCallConnectionState,
  VideoState,
  VideoRotation,
} from '../../lib/secret-sauce';
import type {
  ApiChat,
  ApiChatFullInfo,
  ApiTypingStatus,
  ApiChatMember,
  ApiChatFolder,
} from './chats';
import type {
  ApiFormattedText, ApiMessage, ApiPhoto, ApiPoll, ApiReactions, ApiStickerSet, ApiThreadInfo,
} from './messages';
import type { ApiUser, ApiUserFullInfo, ApiUserStatus } from './users';
import type {
  ApiEmojiInteraction, ApiError, ApiInviteInfo, ApiNotifyException, ApiSessionData,
} from './misc';
import type {
  ApiGroupCall, ApiPhoneCall,
} from './calls';
import type { ApiBotMenuButton } from './bots';
import type { ApiPrivacyKey, PrivacyVisibility } from '../../types';

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
  isCodeViaApp?: boolean;
  hint?: string;
  qrCode?: { token: string; expires: number };
};

export type ApiUpdateSession = {
  '@type': 'updateSession';
  sessionData?: ApiSessionData;
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
  id: string;
  chat: Partial<ApiChat>;
  newProfilePhoto?: ApiPhoto;
  noTopChatsRequest?: boolean;
};

export type ApiUpdateChatJoin = {
  '@type': 'updateChatJoin';
  id: string;
};

export type ApiUpdateShowInvite = {
  '@type': 'showInvite';
  data: ApiInviteInfo;
};

export type ApiUpdateChatLeave = {
  '@type': 'updateChatLeave';
  id: string;
};

export type ApiUpdateChatInbox = {
  '@type': 'updateChatInbox';
  id: string;
  chat: Partial<ApiChat>;
};

export type ApiUpdateChatTypingStatus = {
  '@type': 'updateChatTypingStatus';
  id: string;
  typingStatus: ApiTypingStatus | undefined;
};

export type ApiUpdateStartEmojiInteraction = {
  '@type': 'updateStartEmojiInteraction';
  id: string;
  emoji: string;
  messageId: number;
  interaction: ApiEmojiInteraction;
};

export type ApiUpdateChatFullInfo = {
  '@type': 'updateChatFullInfo';
  id: string;
  fullInfo: Partial<ApiChatFullInfo>;
};

export type ApiUpdateChatMembers = {
  '@type': 'updateChatMembers';
  id: string;
  replacedMembers?: ApiChatMember[];
  addedMember?: ApiChatMember;
  deletedMemberId?: string;
};

export type ApiUpdatePinnedChatIds = {
  '@type': 'updatePinnedChatIds';
  ids: string[];
  folderId?: number;
};

export type ApiUpdateChatListType = {
  '@type': 'updateChatListType';
  id: string;
  folderId: number;
};

export type ApiUpdateChatPinned = {
  '@type': 'updateChatPinned';
  id: string;
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
  chatId: string;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdateNewMessage = {
  '@type': 'newMessage';
  chatId: string;
  id: number;
  message: Partial<ApiMessage>;
  shouldForceReply?: boolean;
};

export type ApiUpdateMessage = {
  '@type': 'updateMessage';
  chatId: string;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdateScheduledMessage = {
  '@type': 'updateScheduledMessage';
  chatId: string;
  id: number;
  message: Partial<ApiMessage>;
};

export type ApiUpdatePinnedMessageIds = {
  '@type': 'updatePinnedIds';
  chatId: string;
  isPinned?: boolean;
  messageIds: number[];
};

export type ApiUpdateThreadInfo = {
  '@type': 'updateThreadInfo';
  chatId: string;
  threadId: number;
  threadInfo: Partial<ApiThreadInfo>;
  firstMessageId?: number;
};

export type ApiUpdateScheduledMessageSendSucceeded = {
  '@type': 'updateScheduledMessageSendSucceeded';
  chatId: string;
  localId: number;
  message: ApiMessage;
};

export type ApiUpdateMessageSendSucceeded = {
  '@type': 'updateMessageSendSucceeded';
  chatId: string;
  localId: number;
  message: ApiMessage;
};

export type ApiUpdateMessageSendFailed = {
  '@type': 'updateMessageSendFailed';
  chatId: string;
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
  channelId: string;
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
  userId: string;
  options: string[];
};

export type ApiUpdateServiceNotification = {
  '@type': 'updateServiceNotification';
  message: ApiMessage;
};

export type ApiUpdateDeleteMessages = {
  '@type': 'deleteMessages';
  ids: number[];
  chatId?: string;
};

export type ApiUpdateDeleteScheduledMessages = {
  '@type': 'deleteScheduledMessages';
  ids: number[];
  chatId?: string;
};

export type ApiUpdateDeleteHistory = {
  '@type': 'deleteHistory';
  chatId: string;
};

export type ApiUpdateDeleteProfilePhotos = {
  '@type': 'deleteProfilePhotos';
  ids: string[];
  chatId: string;
};

export type ApiUpdateResetMessages = {
  '@type': 'resetMessages';
  id: string;
};

export type ApiUpdateDraftMessage = {
  '@type': 'draftMessage';
  chatId: string;
  formattedText?: ApiFormattedText;
  date?: number;
  replyingToId?: number;
};

export type ApiUpdateMessageReactions = {
  '@type': 'updateMessageReactions';
  id: number;
  chatId: string;
  reactions: ApiReactions;
};

export type ApiDeleteContact = {
  '@type': 'deleteContact';
  id: string;
};

export type ApiUpdateUser = {
  '@type': 'updateUser';
  id: string;
  user: Partial<ApiUser>;
};

export type ApiUpdateUserStatus = {
  '@type': 'updateUserStatus';
  userId: string;
  status: ApiUserStatus;
};

export type ApiUpdateUserFullInfo = {
  '@type': 'updateUserFullInfo';
  id: string;
  fullInfo: Partial<ApiUserFullInfo>;
};

export type ApiUpdateAvatar = {
  '@type': 'updateAvatar';
  chatId: string;
  dataUri: string;
};

export type ApiUpdateMessageImage = {
  '@type': 'updateMessageImage';
  messageId: number;
  dataUri: string;
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

export type ApiUpdateRecentStickers = {
  '@type': 'updateRecentStickers';
};

export type ApiUpdateStickerSets = {
  '@type': 'updateStickerSets';
};

export type ApiUpdateStickerSetsOrder = {
  '@type': 'updateStickerSetsOrder';
  order: string[];
};

export type ApiUpdateStickerSet = {
  '@type': 'updateStickerSet';
  id: string;
  stickerSet: Partial<ApiStickerSet>;
};

export type ApiUpdateSavedGifs = {
  '@type': 'updateSavedGifs';
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
} & ApiNotifyException;

export type ApiUpdateTwoFaStateWaitCode = {
  '@type': 'updateTwoFaStateWaitCode';
  length: number;
};

export type ApiUpdatePeerBlocked = {
  '@type': 'updatePeerBlocked';
  id: string;
  isBlocked: boolean;
};

export type ApiUpdatePaymentVerificationNeeded = {
  '@type': 'updatePaymentVerificationNeeded';
  url: string;
};

export type ApiUpdatePaymentStateCompleted = {
  '@type': 'updatePaymentStateCompleted';
};

export type ApiUpdatePrivacy = {
  '@type': 'updatePrivacy';
  key: ApiPrivacyKey;
  rules: {
    visibility: PrivacyVisibility;
    allowUserIds: string[];
    allowChatIds: string[];
    blockUserIds: string[];
    blockChatIds: string[];
  };
};

export type ApiUpdateServerTimeOffset = {
  '@type': 'updateServerTimeOffset';
  serverTimeOffset: number;
};

export type ApiUpdateGroupCall = {
  '@type': 'updateGroupCall';
  call: ApiGroupCall;
};

export type ApiUpdateGroupCallChatId = {
  '@type': 'updateGroupCallChatId';
  call: Partial<ApiGroupCall>;
  chatId: string;
};

export type ApiUpdateGroupCallLeavePresentation = {
  '@type': 'updateGroupCallLeavePresentation';
};

export type ApiUpdateGroupCallParticipants = {
  '@type': 'updateGroupCallParticipants';
  groupCallId: string;
  participants: GroupCallParticipant[];
  nextOffset?: string;
};

export type ApiUpdatePendingJoinRequests = {
  '@type': 'updatePendingJoinRequests';
  chatId: string;
  recentRequesterIds: string[];
  requestsPending: number;
};

export type ApiUpdateGroupCallConnection = {
  '@type': 'updateGroupCallConnection';
  data: GroupCallConnectionData;
  presentation: boolean;
};

export type ApiUpdateGroupCallStreams = {
  '@type': 'updateGroupCallStreams';
  userId: string;
  hasAudioStream: boolean;
  hasVideoStream: boolean;
  hasPresentationStream: boolean;
};

export type ApiUpdateGroupCallConnectionState = {
  '@type': 'updateGroupCallConnectionState';
  connectionState: GroupCallConnectionState;
  isSpeakerDisabled?: boolean;
};

export type ApiUpdatePhoneCall = {
  '@type': 'updatePhoneCall';
  call: ApiPhoneCall;
};

export type ApiUpdatePhoneCallSignalingData = {
  '@type': 'updatePhoneCallSignalingData';
  callId: string;
  data: number[];
};

export type ApiUpdatePhoneCallMediaState = {
  '@type': 'updatePhoneCallMediaState';
  isMuted: boolean;
  videoState: VideoState;
  videoRotation: VideoRotation;
  screencastState: VideoState;
  isBatteryLow: boolean;
};

export type ApiUpdatePhoneCallConnectionState = {
  '@type': 'updatePhoneCallConnectionState';
  connectionState: RTCPeerConnectionState;
};

export type ApiUpdateWebViewResultSent = {
  '@type': 'updateWebViewResultSent';
  queryId: string;
};

export type ApiUpdateBotMenuButton = {
  '@type': 'updateBotMenuButton';
  botId: string;
  button: ApiBotMenuButton;
};

export type ApiUpdate = (
  ApiUpdateReady | ApiUpdateSession |
  ApiUpdateAuthorizationState | ApiUpdateAuthorizationError | ApiUpdateConnectionState | ApiUpdateCurrentUser |
  ApiUpdateChat | ApiUpdateChatInbox | ApiUpdateChatTypingStatus | ApiUpdateChatFullInfo | ApiUpdatePinnedChatIds |
  ApiUpdateChatMembers | ApiUpdateChatJoin | ApiUpdateChatLeave | ApiUpdateChatPinned | ApiUpdatePinnedMessageIds |
  ApiUpdateChatListType | ApiUpdateChatFolder | ApiUpdateChatFoldersOrder | ApiUpdateRecommendedChatFolders |
  ApiUpdateNewMessage | ApiUpdateMessage | ApiUpdateThreadInfo | ApiUpdateCommonBoxMessages | ApiUpdateChannelMessages |
  ApiUpdateDeleteMessages | ApiUpdateMessagePoll | ApiUpdateMessagePollVote | ApiUpdateDeleteHistory |
  ApiUpdateMessageSendSucceeded | ApiUpdateMessageSendFailed | ApiUpdateServiceNotification |
  ApiDeleteContact | ApiUpdateUser | ApiUpdateUserStatus | ApiUpdateUserFullInfo | ApiUpdateDeleteProfilePhotos |
  ApiUpdateAvatar | ApiUpdateMessageImage | ApiUpdateDraftMessage |
  ApiUpdateError | ApiUpdateResetContacts | ApiUpdateStartEmojiInteraction |
  ApiUpdateFavoriteStickers | ApiUpdateStickerSet | ApiUpdateStickerSets | ApiUpdateStickerSetsOrder |
  ApiUpdateRecentStickers | ApiUpdateSavedGifs | ApiUpdateNewScheduledMessage |
  ApiUpdateScheduledMessageSendSucceeded | ApiUpdateScheduledMessage |
  ApiUpdateDeleteScheduledMessages | ApiUpdateResetMessages |
  ApiUpdateTwoFaError | ApiUpdateTwoFaStateWaitCode | ApiUpdateWebViewResultSent |
  ApiUpdateNotifySettings | ApiUpdateNotifyExceptions | ApiUpdatePeerBlocked | ApiUpdatePrivacy |
  ApiUpdateServerTimeOffset | ApiUpdateShowInvite | ApiUpdateMessageReactions |
  ApiUpdateGroupCallParticipants | ApiUpdateGroupCallConnection | ApiUpdateGroupCall | ApiUpdateGroupCallStreams |
  ApiUpdateGroupCallConnectionState | ApiUpdateGroupCallLeavePresentation | ApiUpdateGroupCallChatId |
  ApiUpdatePendingJoinRequests | ApiUpdatePaymentVerificationNeeded | ApiUpdatePaymentStateCompleted |
  ApiUpdatePhoneCall | ApiUpdatePhoneCallSignalingData | ApiUpdatePhoneCallMediaState |
  ApiUpdatePhoneCallConnectionState | ApiUpdateBotMenuButton
);

export type OnApiUpdate = (update: ApiUpdate) => void;
