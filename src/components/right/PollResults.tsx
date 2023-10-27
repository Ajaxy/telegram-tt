import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChat, ApiMessage } from '../../api/types';

import { getMessagePoll } from '../../global/helpers';
import { selectChat, selectChatMessage, selectTabState } from '../../global/selectors';
import { buildCollectionByKey } from '../../util/iteratees';
import renderText from '../common/helpers/renderText';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import Loading from '../ui/Loading';
import PollAnswerResults from './PollAnswerResults';

import './PollResults.scss';

type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  message?: ApiMessage;
};

const PollResults: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  message,
  onClose,
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
        {summary.answers.map((answer) => (
          <PollAnswerResults
            key={`${message.id}-${answer.option}`}
            chat={chat}
            message={message}
            answer={answer}
            answerVote={resultsByOption[answer.option]}
            totalVoters={results.totalVoters!}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      pollResults: { chatId, messageId },
    } = selectTabState(global);

    if (!chatId || !messageId) {
      return {};
    }

    const chat = selectChat(global, chatId);
    const message = selectChatMessage(global, chatId, messageId);

    return {
      chat,
      message,
    };
  },
)(PollResults));
