import { GlobalState } from '../../../../global/types';
import {
  ApiChat, ApiGlobalMessageSearchType, ApiMessage, ApiUser,
} from '../../../../api/types';
import { ISettings } from '../../../../types';

import { selectTheme } from '../../../../modules/selectors';

export type StateProps = {
  theme: ISettings['theme'];
  isLoading?: boolean;
  chatsById: Record<number, ApiChat>;
  usersById: Record<number, ApiUser>;
  globalMessagesByChatId?: Record<number, { byId: Record<number, ApiMessage> }>;
  foundIds?: string[];
  lastSyncTime?: number;
  searchChatId?: number;
};

export function createMapStateToProps(type: ApiGlobalMessageSearchType) {
  return (global: GlobalState, props: any) => {
    const { byId: chatsById } = global.chats;
    const { byId: usersById } = global.users;
    const {
      fetchingStatus, resultsByType, chatId,
    } = global.globalSearch;

    // One component is used for two different types of results.
    // The differences between them are only in the isVoice property.
    // The rest of the search results use their own personal components.
    const currentType = type !== 'audio' ? type : (props?.isVoice ? 'voice' : 'audio');

    const { byChatId: globalMessagesByChatId } = global.messages;
    const foundIds = resultsByType?.[currentType]?.foundIds;

    return {
      theme: selectTheme(global),
      isLoading: foundIds === undefined
        || (fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false),
      chatsById,
      usersById,
      globalMessagesByChatId,
      foundIds,
      searchChatId: chatId,
      lastSyncTime: global.lastSyncTime,
    };
  };
}
