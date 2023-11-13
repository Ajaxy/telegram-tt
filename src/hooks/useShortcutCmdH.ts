import { useCallback, useEffect } from '../lib/teact/teact';

import { IS_MAC_OS } from '../util/windowEnvironment';
import useSnooze from './useSnooze';

function useShortcutCmdH() {
  const { snooze } = useSnooze();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && e.code === 'KeyH') {
      e.preventDefault();
      snooze();
    }
  }, [snooze]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdH;
