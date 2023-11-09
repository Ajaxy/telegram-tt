import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import { selectCurrentChat, selectTabState } from '../global/selectors';
import { IS_MAC_OS } from '../util/windowEnvironment';
import { useJune } from './useJune';

function useShortcutCmdE() {
  const { openChat, toggleChatArchived, closeForumPanel } = getActions();

  const { track } = useJune();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code === 'KeyE') {
      e.preventDefault();

      const global = getGlobal();
      const currentChatId = selectCurrentChat(global)?.id;
      const forumPanelChatId = selectTabState(global).forumPanelChatId;

      const togglingChatId = currentChatId || forumPanelChatId;
      if (togglingChatId) {
        toggleChatArchived({ id: togglingChatId });
        openChat({ id: undefined });
        if (togglingChatId === forumPanelChatId) {
          closeForumPanel();
        }
        if (track) {
          track('toggleChatArchived');
        }
      }
    }
  }, [openChat, closeForumPanel, track]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdE;
