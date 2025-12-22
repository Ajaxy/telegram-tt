import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChat, ApiMessage, ApiPoll } from '../../api/types';

import {
  selectChat, selectChatMessage, selectPollFromMessage, selectTabState,
} from '../../global/selectors';
import { buildCollectionByKey } from '../../util/iteratees';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useHistoryBack from '../../hooks/useHistoryBack';
import useOldLang from '../../hooks/useOldLang';

import Loading from '../ui/Loading';
import PollAnswerResults from './PollAnswerResults';

import './PollResults.scss';

export type OwnProps = {
  isActive: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  chat?: ApiChat;
  message?: ApiMessage;
  poll?: ApiPoll;
};

const PollResults = ({
  isActive,
  chat,
  message,
  poll,
  onClose,
}: OwnProps & StateProps) => {
  const lang = useOldLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  if (!message || !poll || !chat) {
    return <Loading />;
  }

  const { summary, results } = poll;
  if (!results.results) {
    return undefined;
  }

  const resultsByOption = buildCollectionByKey(results.results, 'option');

  return (
    <div className="PollResults" dir={lang.isRtl ? 'rtl' : undefined}>
      <h3 className="poll-question" dir="auto">
        {renderTextWithEntities({
          text: summary.question.text,
          entities: summary.question.entities,
        })}
      </h3>
      <div className="poll-results-list custom-scroll">
        {summary.answers.map((answer) => (
          <PollAnswerResults
            key={`${poll.id}-${answer.option}`}
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
  (global): Complete<StateProps> => {
    const {
      pollResults: { chatId, messageId },
    } = selectTabState(global);

    const chat = chatId ? selectChat(global, chatId) : undefined;
    const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;
    const poll = message && selectPollFromMessage(global, message);

    return {
      chat,
      message,
      poll,
    };
  },
)(PollResults));
