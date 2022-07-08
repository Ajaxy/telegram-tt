import { useHotkeys } from '../../../hooks/useHotkeys';

const useCopySelectedMessages = (isActive: boolean, copySelectedMessages: NoneToVoidFunction) => {
  function handleCopy(e: KeyboardEvent) {
    if (!isActive) {
      return;
    }

    e.preventDefault();
    copySelectedMessages();
  }

  useHotkeys({ 'Mod+C': handleCopy });
};

export default useCopySelectedMessages;
