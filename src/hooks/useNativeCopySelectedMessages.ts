import { useHotkeys } from './useHotkeys';
import getMessageIdsForSelectedText from '../util/getMessageIdsForSelectedText';

const useNativeCopySelectedMessages = (copyMessagesByIds: ({ messageIds }: { messageIds?: number[] }) => void) => {
  function handleCopy(e: KeyboardEvent) {
    const messageIds = getMessageIdsForSelectedText();

    if (messageIds && messageIds.length > 0) {
      e.preventDefault();
      copyMessagesByIds({ messageIds });
    }
  }

  useHotkeys({ 'Meta+C': handleCopy });
};

export default useNativeCopySelectedMessages;
