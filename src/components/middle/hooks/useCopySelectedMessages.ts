import { getActions } from '../../../global';

import { useHotkeys } from '../../../hooks/useHotkeys';

const useCopySelectedMessages = (isActive?: boolean) => {
  function handleCopy(e: KeyboardEvent) {
    e.preventDefault();
    getActions().copySelectedMessages();
  }

  useHotkeys(isActive ? { 'Mod+C': handleCopy } : undefined);
};

export default useCopySelectedMessages;
