import { useCallback, useEffect } from '../lib/teact/teact';

import { IS_MAC_OS } from '../util/windowEnvironment';
import useCommands from './useCommands';

function useShortcutCmdF() {
  const { runCommand } = useCommands();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && !e.shiftKey && e.code === 'KeyF') {
      e.preventDefault();
      runCommand('OPEN_CHAT_SEARCH');
    }
  }, [runCommand]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdF;
