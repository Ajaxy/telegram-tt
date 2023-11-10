import { useCallback, useEffect } from '../lib/teact/teact';

import { IS_LINUX, IS_MAC_OS } from '../util/windowEnvironment';
import useArchiver from './useArchiver';

function useShortcutCmdE() {
  const { archiveChat } = useArchiver({ isManual: true });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code === 'KeyE') {
      e.preventDefault();
      // Cmd+Shift+e - unarchive (Doesn't work on Linux)
      archiveChat({ value: !IS_LINUX ? e.shiftKey : undefined });
    }
  }, [archiveChat]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdE;
