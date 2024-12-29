import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { MessageList as GlobalMessageList } from '../../types';

import { selectTabState } from '../../global/selectors';
import { createLocationHash } from '../../util/routing';

import useHistoryBack from '../../hooks/useHistoryBack';

type StateProps = {
  messageLists?: GlobalMessageList[];
};

// Actual `MessageList` components are unmounted when deep in the history,
// so we need a separate component just for handling history
const MessageListHistoryHandler: FC<StateProps> = ({ messageLists }) => {
  const { openChat } = getActions();

  const closeChat = () => {
    openChat({ id: undefined }, { forceSyncOnIOs: true });
  };

  const MessageHistoryRecord: FC<GlobalMessageList> = ({ chatId, type, threadId }) => {
    useHistoryBack({
      isActive: true,
      hash: createLocationHash(chatId, type, threadId),
      onBack: closeChat,
    });
  };

  return (
    <div>
      {messageLists?.map((messageList, i) => (
        <MessageHistoryRecord
          // eslint-disable-next-line react/no-array-index-key
          key={`${messageList.chatId}_${messageList.threadId}_${messageList.type}_${i}`}
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...messageList}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    return {
      messageLists: selectTabState(global).messageLists,
    };
  },
)(MessageListHistoryHandler));
