import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../lib/teact/teactn';

import { createMessageHash } from '../../util/routing';
import useHistoryBack from '../../hooks/useHistoryBack';
import type { MessageList as GlobalMessageList } from '../../global/types';

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
      hash: createMessageHash(chatId, type, threadId),
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
      messageLists: global.messages.messageLists,
    };
  },
)(MessageListHistoryHandler));
