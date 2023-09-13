import getMessageIdsForSelectedText from '../util/getMessageIdsForSelectedText';
import { useHotkeys } from './useHotkeys';

const useNativeCopySelectedMessages = (copyMessagesByIds: ({ messageIds }: { messageIds?: number[] }) => void) => {
  function handleCopy(e: KeyboardEvent) {
    const messageIds = getMessageIdsForSelectedText();

    if (messageIds && messageIds.length > 1) {
      e.preventDefault();
      copyMessagesByIds({ messageIds });
    }
  }

  useHotkeys({ 'Mod+C': handleCopy });
};

export default useNativeCopySelectedMessages;
