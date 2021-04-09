import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiMessage, ApiChat } from '../../api/types';
import { selectChat, selectChatMessage } from '../../modules/selectors';
import { buildCollectionByKey } from '../../util/iteratees';
import { getMessagePoll } from '../../modules/helpers';

import PollAnswerResults from './PollAnswerResults';
import Loading from '../ui/Loading';

import './PollResults.scss';

type StateProps = {
  chat?: ApiChat;
  message?: ApiMessage;
  lastSyncTime?: number;
};

const PollResults: FC<StateProps> = ({
  chat,
  message,
  lastSyncTime,
}) => {
  if (!message || !chat) {
    return <Loading />;
  }

  const { summary, results } = getMessagePoll(message)!;
  if (!results.results) {
    return undefined;
  }

  const resultsByOption = buildCollectionByKey(results.results, 'option');

  return (
    <div className="PollResults">
      <h3 className="poll-question">{summary.question}</h3>
      <div className="poll-results-list custom-scroll">
        {lastSyncTime && summary.answers.map((answer) => (
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
