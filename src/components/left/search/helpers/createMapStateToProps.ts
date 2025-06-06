import type {
  ApiChat, ApiGlobalMessageSearchType, ApiMessage, ApiUser,
} from '../../../../api/types';
import type { GlobalState, TabState } from '../../../../global/types';
import type { ThemeKey } from '../../../../types';
import type { SearchResultKey } from '../../../../util/keys/searchResultKey';

import { selectChat, selectTabState, selectTheme } from '../../../../global/selectors';
import { selectSharedSettings } from '../../../../global/selectors/sharedState';

export type StateProps = {
  theme: ThemeKey;
  isLoading?: boolean;
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  globalMessagesByChatId?: Record<string, { byId: Record<number, ApiMessage> }>;
  foundIds?: SearchResultKey[];
  searchChatId?: string;
  activeDownloads: TabState['activeDownloads'];
  isChatProtected?: boolean;
  shouldWarnAboutSvg?: boolean;
};

export function createMapStateToProps(type: ApiGlobalMessageSearchType) {
  return (global: GlobalState, props: any) => {
    const tabState = selectTabState(global);
    const { byId: chatsById } = global.chats;
    const { byId: usersById } = global.users;
    const {
      fetchingStatus, resultsByType, chatId,
    } = tabState.globalSearch;

    const { shouldWarnAboutSvg } = selectSharedSettings(global);

    // One component is used for two different types of results.
    // The differences between them are only in the isVoice property.
    // The rest of the search results use their own personal components.
    const currentType = type !== 'audio' ? type : (props?.isVoice ? 'voice' : 'audio');

    const { byChatId: globalMessagesByChatId } = global.messages;
    const foundIds = resultsByType?.[currentType]?.foundIds;

    const activeDownloads = tabState.activeDownloads;

    return {
      theme: selectTheme(global),
      isLoading: foundIds === undefined
        || (fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false),
      chatsById,
      usersById,
      globalMessagesByChatId,
      foundIds,
      searchChatId: chatId,
      activeDownloads,
      isChatProtected: chatId ? selectChat(global, chatId)?.isProtected : undefined,
      shouldWarnAboutSvg,
    };
  };
}
