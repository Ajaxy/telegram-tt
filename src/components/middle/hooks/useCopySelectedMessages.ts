import { useHotkeys } from '../../../hooks/useHotkeys';

const useCopySelectedMessages = (isActive: boolean, copySelectedMessages: NoneToVoidFunction) => {
  function handleCopy(e: KeyboardEvent) {
    if (!isActive) {
      return;
    }

    e.preventDefault();
    copySelectedMessages();
  }

  useHotkeys({ 'meta+C': handleCopy });
};

export default useCopySelectedMessages;
