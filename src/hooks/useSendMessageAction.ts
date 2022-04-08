import { useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import { ApiSendMessageAction } from '../api/types';

import { SEND_MESSAGE_ACTION_INTERVAL } from '../config';
import { throttle } from '../util/schedulers';

const useSendMessageAction = (chatId?: string, threadId?: number) => {
  return useMemo(() => {
    return throttle((action: ApiSendMessageAction) => {
      getActions().sendMessageAction({ chatId, threadId, action });
    }, SEND_MESSAGE_ACTION_INTERVAL);
  }, [chatId, threadId]);
};

export default useSendMessageAction;
