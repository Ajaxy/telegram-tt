import { useEffect } from '../../../lib/teact/teact';
import { IS_MAC_OS } from '../../../util/environment';
import getKeyFromEvent from '../../../util/getKeyFromEvent';

const useCopySelectedMessages = (isActive: boolean, copySelectedMessages: NoneToVoidFunction) => {
  useEffect(() => {
    function handleCopy(e: KeyboardEvent) {
      if (((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey)) && getKeyFromEvent(e) === 'c') {
        e.preventDefault();
        copySelectedMessages();
      }
    }

    if (isActive) {
      document.addEventListener('keydown', handleCopy, false);
    }

    return () => {
      document.removeEventListener('keydown', handleCopy, false);
    };
  }, [copySelectedMessages, isActive]);
};

export default useCopySelectedMessages;
