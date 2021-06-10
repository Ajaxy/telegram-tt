import React, {
  FC, useCallback, useState, memo, useEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import {
  ApiChat,
  ApiMessage,
  ApiPollAnswer,
  ApiPollResult,
} from '../../api/types';
import { GlobalActions } from '../../global/types';
import { pick } from '../../util/iteratees';
import usePrevious from '../../hooks/usePrevious';

import ShowMoreButton from '../ui/ShowMoreButton';
import Loading from '../ui/Loading';
import ListItem from '../ui/ListItem';
import PrivateChatInfo from '../common/PrivateChatInfo';

import './PollAnswerResults.scss';

type OwnProps = {
  chat: ApiChat;
  message: ApiMessage;
  answer: ApiPollAnswer;
  answerVote: ApiPollResult;
  totalVoters: number;
};

type StateProps = {
  voters?: number[];
  offset: string;
};

type DispatchProps = Pick<GlobalActions, 'loadPollOptionResults' | 'openChat' | 'closePollResults'>;

const INITIAL_LIMIT = 4;
const VIEW_MORE_LIMIT = 50;

const PollAnswerResults: FC<OwnProps & StateProps & DispatchProps> = ({
  chat,
  message,
  answer,
  answerVote,
  totalVoters,
  voters,
  offset,
  loadPollOptionResults,
  openChat,
  closePollResults,
}) => {
  const prevVotersCount = usePrevious<number>(answerVote.votersCount);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const areVotersLoaded = Boolean(voters);
  const { option, text } = answer;

  useEffect(() => {
    // For update when new votes arrive or when the user takes back his vote
    if (!areVotersLoaded || prevVotersCount !== answerVote.votersCount) {
      loadPollOptionResults({
        chat, messageId: message.id, option, offset, limit: INITIAL_LIMIT, shouldResetVoters: true,
      });
    }
    // eslint-disable-next-line
  }, [answerVote.votersCount, areVotersLoaded]);

  const handleViewMoreClick = useCallback(() => {
    setIsLoading(true);
    loadPollOptionResults({
      chat, messageId: message.id, option, offset, limit: VIEW_MORE_LIMIT,
    });
  }, [chat, loadPollOptionResults, message.id, offset, option]);

  useEffect(() => {
    setIsLoading(false);
  }, [voters]);

  const handleMemberClick = useCallback((id: number) => {
    openChat({ id });
    closePollResults();
  }, [closePollResults, openChat]);

  function renderViewMoreButton() {
    const leftVotersCount = answerVote.votersCount - voters!.length;

    return answerVote.votersCount > INITIAL_LIMIT && leftVotersCount > 0 && (
      <ShowMoreButton
        count={leftVotersCount}
        itemName="voter"
        isLoading={isLoading}
        onClick={handleViewMoreClick}
      />
    );
  }

  return (
    <div className="PollAnswerResults">
      <div className="poll-voters">
        {voters
          ? voters.map((id) => (
            <ListItem
              key={id}
              className="chat-item-clickable"
              onClick={() => handleMemberClick(id)}
            >
              <PrivateChatInfo
                avatarSize="tiny"
                userId={id}
                forceShowSelf
                noStatusOrTyping
              />
            </ListItem>
          ))
          : <Loading />}
        {voters && renderViewMoreButton()}
      </div>
      <div className="answer-head">
        <span className="answer-title" dir="auto">{text}</span>
        <span className="answer-percent">{getPercentage(answerVote.votersCount, totalVoters)}%</span>
      </div>
    </div>
  );
};

function getPercentage(value: number, total: number) {
  return total > 0 ? ((value / total) * 100).toFixed() : 0;
}

export default memo(withGlobal<OwnProps>(
  (global, { answer }: OwnProps): StateProps => {
    const { voters, offsets } = global.pollResults;

    return {
      voters: voters && voters[answer.option],
      offset: (offsets && offsets[answer.option]) || '',
    };
  },
  (global, actions): DispatchProps => pick(actions, ['loadPollOptionResults', 'openChat', 'closePollResults']),
)(PollAnswerResults));
