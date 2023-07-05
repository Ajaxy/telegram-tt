import { useEffect } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiMessage } from '../api/types';

export default function useEnsureMessage(
  chatId: string,
  messageId?: number,
  message?: ApiMessage,
  replyOriginForId?: number,
) {
  const { loadMessage } = getActions();

  useEffect(() => {
    if (messageId && !message) {
      loadMessage({ chatId, messageId: messageId!, replyOriginForId: replyOriginForId! });
    }
  }, [chatId, message, messageId, replyOriginForId]);
}
