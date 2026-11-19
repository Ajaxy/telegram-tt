import { useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useKeyboardShortcuts from '../../../hooks/useKeyboardShortcuts';

const useCopySelectedMessages = (isActive?: boolean) => {
  function handleCopy() {
    getActions().copySelectedMessages();
  }

  useKeyboardShortcuts(useMemo(() => (isActive ? {
    copySelectedMessages: handleCopy,
  } : undefined), [isActive]));
};

export default useCopySelectedMessages;
