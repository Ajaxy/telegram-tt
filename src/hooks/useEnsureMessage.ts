import { useEffect, useMemo } from '../lib/teact/teact';
import { getDispatch } from '../lib/teact/teactn';

import { ApiMessage } from '../api/types';

import { throttle } from '../util/schedulers';

const useEnsureMessage = (
  chatId: string,
  messageId?: number,
  message?: ApiMessage,
  replyOriginForId?: number,
) => {
  const { loadMessage } = getDispatch();
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
