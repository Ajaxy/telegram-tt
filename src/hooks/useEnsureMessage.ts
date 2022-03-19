import { useEffect, useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import { ApiMessage } from '../api/types';

import { throttle } from '../util/schedulers';

const useEnsureMessage = (
  chatId: string,
  messageId?: number,
  message?: ApiMessage,
  replyOriginForId?: number,
) => {
  const { loadMessage } = getActions();
  const loadMessageThrottled = useMemo(() => {
    const throttled = throttle(loadMessage, 500, true);
    return () => {
      throttled({ chatId, messageId, replyOriginForId });
    };
  }, [loadMessage, chatId, messageId, replyOriginForId]);

  useEffect(() => {
    if (messageId && !message) {
      loadMessageThrottled();
    }
  });
};

export default useEnsureMessage;
