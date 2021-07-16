import { GlobalState } from '../../global/types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getSystemTheme, IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentMessageList, selectIsPollResultsOpen } from './messages';
import { selectCurrentTextSearch } from './localSearch';
import { selectCurrentStickerSearch, selectCurrentGifSearch } from './symbols';
import { selectAreActiveChatsLoaded } from './chats';
import { selectCurrentManagement } from './management';

export function selectIsMediaViewerOpen(global: GlobalState) {
  const { mediaViewer } = global;
  return Boolean(mediaViewer.messageId || mediaViewer.avatarOwnerId);
}

export function selectRightColumnContentKey(global: GlobalState) {
  const {
    users,
    isChatInfoShown,
    newChatMembersProgress,
  } = global;

  const isAddingChatMembersShown = newChatMembersProgress !== NewChatMembersProgress.Closed;
  const isPollResults = selectIsPollResultsOpen(global);
  const isSearch = Boolean(!IS_SINGLE_COLUMN_LAYOUT && selectCurrentTextSearch(global));
  const isManagement = selectCurrentManagement(global);
  const stickerSearch = selectCurrentStickerSearch(global);
  const isStickerSearch = stickerSearch.query !== undefined;
  const gifSearch = selectCurrentGifSearch(global);
  const isGifSearch = gifSearch.query !== undefined;
  const { chatId: currentChatId } = selectCurrentMessageList(global) || {};
  const currentProfileUserId = users.selectedId;
  const areActiveChatsLoaded = selectAreActiveChatsLoaded(global);
  const isUserInfo = Boolean(currentProfileUserId && areActiveChatsLoaded);
  const isChatShown = Boolean(currentChatId && areActiveChatsLoaded);
  const isChatInfo = isChatShown && isChatInfoShown;

  return isPollResults ? (
    RightColumnContent.PollResults
  ) : isSearch ? (
    RightColumnContent.Search
  ) : isManagement ? (
    RightColumnContent.Management
  ) : isStickerSearch ? (
    RightColumnContent.StickerSearch
  ) : isGifSearch ? (
    RightColumnContent.GifSearch
  ) : isAddingChatMembersShown ? (
    RightColumnContent.AddingMembers
  ) : isUserInfo ? (
    RightColumnContent.UserInfo
  ) : isChatInfo ? (
    RightColumnContent.ChatInfo
  ) : undefined;
}

export function selectIsRightColumnShown(global: GlobalState) {
  return selectRightColumnContentKey(global) !== undefined;
}

export function selectTheme(global: GlobalState) {
  const { theme, shouldUseSystemTheme } = global.settings.byKey;

  return shouldUseSystemTheme ? getSystemTheme() : theme;
}
