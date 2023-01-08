import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiMessage, ApiChat } from '../../api/types';
import { selectChat, selectChatMessage } from '../../global/selectors';
import { buildCollectionByKey } from '../../util/iteratees';
import { getMessagePoll } from '../../global/helpers';
import renderText from '../common/helpers/renderText';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

import PollAnswerResults from './PollAnswerResults';
import Loading from '../ui/Loading';

import './PollResults.scss';

type OwnProps = {
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  message?: ApiMessage;
  lastSyncTime?: number;
};

const PollResults: FC<OwnProps & StateProps> = ({
  onClose,
  isActive,
  chat,
  message,
  lastSyncTime,
}) => {
  const lang = useLang();
  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  if (!message || !chat) {
    return <Loading />;
  }

  const { summary, results } = getMessagePoll(message)!;
  if (!results.results) {
    return undefined;
  }

  const resultsByOption = buildCollectionByKey(results.results, 'option');

  return (
    <div className="PollResults" dir={lang.isRtl ? 'rtl' : undefined}>
      <h3 className="poll-question" dir="auto">{renderText(summary.question, ['emoji', 'br'])}</h3>
      <div className="poll-results-list custom-scroll">
        {Boolean(lastSyncTime) && summary.answers.map((answer) => (
          <PollAnswerResults
            key={`${message.id}-${answer.option}`}
            chat={chat}
            message={message}
            answer={answer}
            answerVote={resultsByOption[answer.option]}
            totalVoters={results.totalVoters!}
          />
        ))}
        {!lastSyncTime && <Loading />}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      pollResults: { chatId, messageId },
      lastSyncTime,
    } = global;

    if (!chatId || !messageId) {
      return {};
    }

    const chat = selectChat(global, chatId);
    const message = selectChatMessage(global, chatId, messageId);

    return {
      chat,
      message,
      lastSyncTime,
    };
  },
)(PollResults));
