import { useEffect } from '../lib/teact/teact';
import { IS_MAC_OS } from '../util/environment';
import getKeyFromEvent from '../util/getKeyFromEvent';
import getMessageIdsForSelectedText from '../util/getMessageIdsForSelectedText';

const useNativeCopySelectedMessages = (copyMessagesByIds: ({ messageIds }: { messageIds?: number[] }) => void) => {
  useEffect(() => {
    function handleCopy(e: KeyboardEvent) {
      if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && getKeyFromEvent(e) === 'c') {
        const messageIds = getMessageIdsForSelectedText();

        if (messageIds && messageIds.length > 0) {
          e.preventDefault();
          copyMessagesByIds({ messageIds });
        }
      }
    }

    document.addEventListener('keydown', handleCopy, false);

    return () => {
      document.removeEventListener('keydown', handleCopy, false);
    };
  }, [copyMessagesByIds]);
};

export default useNativeCopySelectedMessages;
