import { useCallback, useEffect } from '../lib/teact/teact';

import useCommands from './useCommands';

function useShortcutCmdShiftL() {
  const { runCommand } = useCommands();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyL') {
      runCommand('NEW_LINEAR_TASK');
      e.preventDefault();
      e.stopPropagation();
    }
  }, [runCommand]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useShortcutCmdShiftL;
