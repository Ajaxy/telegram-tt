import { GlobalState } from '../../global/types';
import { NewChatMembersProgress, RightColumnContent } from '../../types';

import { getSystemTheme, IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentMessageList, selectIsPollResultsOpen } from './messages';
import { selectCurrentTextSearch } from './localSearch';
import { selectCurrentGifSearch, selectCurrentStickerSearch } from './symbols';
import { selectCurrentManagement } from './management';

export function selectIsMediaViewerOpen(global: GlobalState) {
  const { mediaViewer } = global;
  return Boolean(mediaViewer.messageId || mediaViewer.avatarOwnerId);
}

export function selectRightColumnContentKey(global: GlobalState) {
  return selectIsPollResultsOpen(global) ? (
    RightColumnContent.PollResults
  ) : !IS_SINGLE_COLUMN_LAYOUT && selectCurrentTextSearch(global) ? (
    RightColumnContent.Search
  ) : selectCurrentManagement(global) ? (
    RightColumnContent.Management
  ) : selectCurrentStickerSearch(global).query !== undefined ? (
    RightColumnContent.StickerSearch
  ) : selectCurrentGifSearch(global).query !== undefined ? (
    RightColumnContent.GifSearch
  ) : global.newChatMembersProgress !== NewChatMembersProgress.Closed ? (
    RightColumnContent.AddingMembers
  ) : global.isChatInfoShown && selectCurrentMessageList(global) ? (
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
