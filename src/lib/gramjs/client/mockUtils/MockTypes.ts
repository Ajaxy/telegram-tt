import type { GramJsAppConfig } from '../../../../api/gramjs/apiBuilders/appConfig';
import type { ApiAvailableReaction } from '../../../../api/types';
import type Api from '../../tl/api';

export type MockDialog = Partial<Api.Dialog> & {
  id: string;
};

export type MockUser = Partial<Api.User> & {
  id: string;
};

export type MockChat = Partial<Api.Chat> & {
  id: string;
};

export type MockForumTopic = Partial<Api.ForumTopic> & {
  id: number;
  topMessage: number;
};

export type MockChannel = Partial<Api.Channel> & {
  id: string;
  title: string;
  forumTopics?: MockForumTopic[];
  bannedRights?: MockBannedRights;
  adminRights?: MockAdminRights;
};

export type MockAdminRights = Api.ChatAdminRights;
export type MockBannedRights = Partial<Api.ChatBannedRights>;

export type MockMessage = Omit<Partial<Api.Message>, 'reactions'> & {
  id: number;
  media?: MockMessageMedia;
  reactions?: MockMessageReactions;
  replyToTopId?: number;
  replyToMsgId?: number;
  replyToForumTopic?: boolean;
};

export type MockMessageMedia = {
  type: 'document' | 'photo';
  id: number;
};

export type MockAvailableReaction = Pick<ApiAvailableReaction, 'title' | 'reaction'> & {
  staticIconId: number;
  animationId: number;
  effectId: number;
};

export type MockMessageReactions = {
  results: {
    emoticon: string;
    count: number;
  }[];
};

export type MockDocument = Partial<Api.Document> & {
  id: number;
  mimeType: string;
  size: bigint;
  url: string;
  bytes: Buffer;
};

export type MockDialogFilter = Partial<Api.DialogFilter> & {
  id: number;
  pinnedPeerIds: string[];
  includePeerIds: string[];
  excludePeerIds: string[];
  title: string;
};

export type MockTypes = {
  appConfig?: GramJsAppConfig;
  users: MockUser[];
  chats: MockChat[];
  channels: MockChannel[];
  dialogs: {
    active: MockDialog[];
    archived: MockDialog[];
  };
  messages: Record<string, MockMessage[]>;
  availableReactions: MockAvailableReaction[];
  documents: MockDocument[];
  dialogFilters: MockDialogFilter[];
  topPeers: string[];
};

export const MOCK_STARTING_DATE = 1_66_69_69_420;
