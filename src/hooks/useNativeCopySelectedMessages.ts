import { useEffect } from '../lib/teact/teact';

import type { MessageListType, ThreadId } from '../types';
import type { MessageCopyRequest } from '../types/messageCopy';

import { captureMessageCopyRequest } from '../components/middle/message/helpers/getSelectionAsFormattedText';
import useLastCallback from './useLastCallback';

const useNativeCopySelectedMessages = (
  isActive: boolean | undefined,
  chatId: string,
  threadId: ThreadId,
  messageListType: MessageListType,
  copyMessagesByIds: (payload: { request: MessageCopyRequest }) => void,
) => {
  const handleCopy = useLastCallback((e: ClipboardEvent) => {
    if (!window.ClipboardItem || !navigator.clipboard?.write) return;

    const request = captureMessageCopyRequest(chatId, threadId, messageListType);
    if (!request) return;

    e.preventDefault();
    copyMessagesByIds({ request });
  });

  useEffect(() => {
    if (!isActive) return undefined;

    document.addEventListener('copy', handleCopy);
    return () => document.removeEventListener('copy', handleCopy);
  }, [handleCopy, isActive]);
};

export default useNativeCopySelectedMessages;
