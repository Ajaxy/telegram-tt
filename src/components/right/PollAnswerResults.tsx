import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
  useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiMessage,
  ApiPollAnswer,
  ApiPollResult,
} from '../../api/types';
import type { PollVote } from '../../global/types/tabState';

import { selectTabState } from '../../global/selectors';
import { formatMediaDateTime } from '../../util/dates/oldDateFormat';
import { isUserId } from '../../util/entities/ids';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import GroupChatInfo from '../common/GroupChatInfo';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ListItem from '../ui/ListItem';
import Loading from '../ui/Loading';
import ShowMoreButton from '../ui/ShowMoreButton';

import './PollAnswerResults.scss';

type OwnProps = {
  chat: ApiChat;
  message: ApiMessage;
  answer: ApiPollAnswer;
  answerVote: ApiPollResult;
  totalVoters: number;
};

type StateProps = {
  votes?: PollVote[];
  offset: string;
};

const INITIAL_LIMIT = 4;
const VIEW_MORE_LIMIT = 50;

const PollAnswerResults: FC<OwnProps & StateProps> = ({
  chat,
  message,
  answer,
  answerVote,
  totalVoters,
  votes,
  offset,
}) => {
  const {
    loadPollOptionResults,
    openChat,
    closePollResults,
  } = getActions();

  const prevVotersCount = usePreviousDeprecated<number>(answerVote.votersCount);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const areVotersLoaded = Boolean(votes);
  const { option, text } = answer;
  const lang = useOldLang();

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
  }, [votes]);

  const handleMemberClick = useCallback((id: string) => {
    openChat({ id });
    closePollResults();
  }, [closePollResults, openChat]);

  function renderViewMoreButton() {
    const leftVotersCount = answerVote.votersCount - votes!.length;

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
        {votes
          ? votes.map(({ peerId, date }) => (
            <ListItem
              key={peerId}
              className="chat-item-clickable"
              onClick={() => handleMemberClick(peerId)}
            >
              {isUserId(peerId) ? (
                <PrivateChatInfo
                  avatarSize="tiny"
                  userId={peerId}
                  forceShowSelf
                  noStatusOrTyping
                />
              ) : (
                <GroupChatInfo
                  avatarSize="tiny"
                  chatId={peerId}
                  noStatusOrTyping
                />
              )}
              <span className="vote-date">
                {formatMediaDateTime(lang, date * 1000, true)}
              </span>
            </ListItem>
          ))
          : <Loading />}
        {votes && renderViewMoreButton()}
      </div>
      <div className="answer-head" dir={lang.isRtl ? 'rtl' : undefined}>
        <span className="answer-title" dir="auto">
          {renderTextWithEntities({
            text: text.text,
            entities: text.entities,
          })}
        </span>
        <span className="answer-percent" dir={lang.isRtl ? 'auto' : undefined}>
          {getPercentage(answerVote.votersCount, totalVoters)}
          %
        </span>
      </div>
    </div>
  );
};

function getPercentage(value: number, total: number) {
  return total > 0 ? ((value / total) * 100).toFixed() : 0;
}

export default memo(withGlobal<OwnProps>(
  (global, { answer }: OwnProps): Complete<StateProps> => {
    const { votesByOption, offsets } = selectTabState(global).pollResults;

    return {
      votes: votesByOption?.[answer.option],
      offset: (offsets?.[answer.option]) || '',
    };
  },
)(PollAnswerResults));
