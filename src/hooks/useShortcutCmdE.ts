import { useCallback, useEffect } from '../lib/teact/teact';
import { getActions, getGlobal } from '../global';

import { selectCurrentChat } from '../global/selectors';
import { IS_MAC_OS } from '../util/windowEnvironment';
import { useJune } from './useJune';

function useShortcutCmdE() {
  const { openChat, toggleChatArchived, closeForumPanel } = getActions();
  const { track } = useJune();

  const global = getGlobal();
  const currentChat = selectCurrentChat(global);
  const chatId = currentChat?.id;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code === 'KeyE') {
      e.preventDefault();
      if (chatId) {
        toggleChatArchived({ id: chatId });
        openChat({ id: undefined });
        closeForumPanel();
        if (track) {
          track('toggleChatArchived');
        }
      }
    }
  }, [chatId, openChat, closeForumPanel, track]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdE;
