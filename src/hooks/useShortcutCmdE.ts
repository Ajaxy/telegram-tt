import { useCallback, useEffect } from '../lib/teact/teact';

import { IS_LINUX, IS_MAC_OS } from '../util/windowEnvironment';
import useDone from './useDone';

function useShortcutCmdE() {
  const { doneChat } = useDone();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code === 'KeyE') {
      e.preventDefault();
      // Cmd+E - Done
      // Cmd+Shift+E - Undone (Doesn't work on Linux)
      doneChat({ value: !IS_LINUX ? !e.shiftKey : undefined });
    }
  }, [doneChat]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdE;
