import { useCallback, useEffect } from '../lib/teact/teact';

import useCommands from './useCommands';

function useShortcutCmdShiftM() {
  const { runCommand } = useCommands();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyM') {
      runCommand('NEW_MEET');
      e.preventDefault();
      e.stopPropagation();
    }
  }, [runCommand]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdShiftM;
