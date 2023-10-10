import type { FC } from '../../../lib/teact/teact';
import React, {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiMessage, ApiPeer, ApiPoll, ApiPollAnswer,
} from '../../../api/types';
import type { LangFn } from '../../../hooks/useLang';

import { formatMediaDuration } from '../../../util/dateFormat';
import { getServerTime } from '../../../util/serverTime';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import CheckboxGroup from '../../ui/CheckboxGroup';
import Notification from '../../ui/Notification';
import RadioGroup from '../../ui/RadioGroup';
import PollOption from './PollOption';

import './Poll.scss';

type OwnProps = {
  message: ApiMessage;
  poll: ApiPoll;
  onSendVote: (options: string[]) => void;
};

type StateProps = {
  recentVoterIds?: number[];
};

const SOLUTION_CONTAINER_ID = '#middle-column-portals';
const SOLUTION_DURATION = 5000;
const TIMER_RADIUS = 6;
const TIMER_CIRCUMFERENCE = TIMER_RADIUS * 2 * Math.PI;
const TIMER_UPDATE_INTERVAL = 1000;
const NBSP = '\u00A0';

const Poll: FC<OwnProps & StateProps> = ({
  message,
  poll,
  recentVoterIds,
  onSendVote,
}) => {
  const { loadMessage, openPollResults, requestConfetti } = getActions();

  const { id: messageId, chatId } = message;
  const { summary, results } = poll;
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [chosenOptions, setChosenOptions] = useState<string[]>([]);
  const [isSolutionShown, setIsSolutionShown] = useState<boolean>(false);
  const [wasSubmitted, setWasSubmitted] = useState<boolean>(false);
  const [closePeriod, setClosePeriod] = useState<number>(
    !summary.closed && summary.closeDate && summary.closeDate > 0
      ? Math.min(summary.closeDate - getServerTime(), summary.closePeriod!)
      : 0,
  );
  // eslint-disable-next-line no-null/no-null
  const countdownRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const timerCircleRef = useRef<SVGCircleElement>(null);
  const { results: voteResults, totalVoters } = results;
  const hasVoted = voteResults && voteResults.some((r) => r.isChosen);
  const canVote = !summary.closed && !hasVoted;
  const canViewResult = !canVote && summary.isPublic && Number(results.totalVoters) > 0;
  const isMultiple = canVote && summary.multipleChoice;
  const maxVotersCount = voteResults ? Math.max(...voteResults.map((r) => r.votersCount)) : totalVoters;
  const correctResults = useMemo(() => {
    return voteResults?.filter((r) => r.isCorrect).map((r) => r.option) || [];
  }, [voteResults]);
  const answers = useMemo(() => summary.answers.map((a) => ({
    label: a.text,
    value: a.option,
    hidden: Boolean(summary.quiz && summary.closePeriod && closePeriod <= 0),
  })), [closePeriod, summary]);

  useEffect(() => {
    const chosen = poll.results.results?.find((result) => result.isChosen);
    if (isSubmitting && chosen) {
      if (chosen.isCorrect) {
        requestConfetti();
      }
      setIsSubmitting(false);
    }
  }, [isSubmitting, poll.results.results, requestConfetti]);

  useLayoutEffect(() => {
    if (closePeriod > 0) {
      setTimeout(() => setClosePeriod(closePeriod - 1), TIMER_UPDATE_INTERVAL);
    }
    if (!timerCircleRef.current) return;

    if (closePeriod <= 5) {
      countdownRef.current!.classList.add('hurry-up');
    }

    const strokeDashOffset = ((summary.closePeriod! - closePeriod) / summary.closePeriod!) * TIMER_CIRCUMFERENCE;
    timerCircleRef.current.setAttribute('stroke-dashoffset', `-${strokeDashOffset}`);
  }, [closePeriod, summary.closePeriod]);

  useEffect(() => {
    if (summary.quiz && (closePeriod <= 0 || (hasVoted && !summary.closed))) {
      loadMessage({ chatId, messageId });
    }
  }, [chatId, closePeriod, hasVoted, loadMessage, messageId, summary.closed, summary.quiz]);

  // If the client time is not synchronized, the poll must be updated after the closePeriod time has expired.
  useEffect(() => {
    let timer: number | undefined;

    if (summary.quiz && !summary.closed && summary.closePeriod && summary.closePeriod > 0) {
      timer = window.setTimeout(() => {
        loadMessage({ chatId, messageId });
      }, summary.closePeriod * 1000);
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [canVote, chatId, loadMessage, messageId, summary.closePeriod, summary.closed, summary.quiz]);

  const recentVoters = useMemo(() => {
    // No need for expensive global updates on chats or users, so we avoid them
    const chatsById = getGlobal().chats.byId;
    const usersById = getGlobal().users.byId;
    return recentVoterIds ? recentVoterIds.reduce((result: ApiPeer[], id) => {
      const chat = chatsById[id];
      const user = usersById[id];
      if (user) {
        result.push(user);
      } else if (chat) {
        result.push(chat);
      }

      return result;
    }, []) : [];
  }, [recentVoterIds]);

  const handleRadioChange = useLastCallback((option: string) => {
    setChosenOptions([option]);
    setIsSubmitting(true);
    setWasSubmitted(true);
    onSendVote([option]);
  });

  const handleCheckboxChange = useLastCallback((options: string[]) => {
    setChosenOptions(options);
  });

  const handleVoteClick = useLastCallback(() => {
    setIsSubmitting(true);
    setWasSubmitted(true);
    onSendVote(chosenOptions);
  });

  const handleViewResultsClick = useLastCallback(() => {
    openPollResults({ chatId, messageId });
  });

  const handleSolutionShow = useLastCallback(() => {
    setIsSolutionShown(true);
  });

  const handleSolutionHide = useLastCallback(() => {
    setIsSolutionShown(false);
    setWasSubmitted(false);
  });

  // Show the solution to quiz if the answer was incorrect
  useEffect(() => {
    if (wasSubmitted && hasVoted && summary.quiz && results.results && poll.results.solution) {
      const correctResult = results.results.find((r) => r.isChosen && r.isCorrect);
      if (!correctResult) {
        setIsSolutionShown(true);
      }
    }
  }, [hasVoted, wasSubmitted, results.results, summary.quiz, poll.results.solution]);

  const lang = useLang();

  function renderResultOption(answer: ApiPollAnswer) {
    return (
      <PollOption
        key={answer.option}
        shouldAnimate={wasSubmitted || !canVote}
        answer={answer}
        voteResults={voteResults}
        totalVoters={totalVoters}
        maxVotersCount={maxVotersCount}
        correctResults={correctResults}
      />
    );
  }

  function renderRecentVoters() {
    return (
      recentVoters.length > 0 && (
        <div className="poll-recent-voters">
          {recentVoters.map((peer) => (
            <Avatar
              key={peer.id}
              size="micro"
              peer={peer}
            />
          ))}
        </div>
      )
    );
  }

  function renderSolution() {
    return (
      isSolutionShown && poll.results.solution && (
        <Notification
          message={renderTextWithEntities({ text: poll.results.solution, entities: poll.results.solutionEntities })}
          duration={SOLUTION_DURATION}
          onDismiss={handleSolutionHide}
          containerId={SOLUTION_CONTAINER_ID}
        />
      )
    );
  }

  return (
    <div className="Poll" dir={lang.isRtl ? 'auto' : 'ltr'}>
      {renderSolution()}
      <div className="poll-question">{renderText(summary.question, ['emoji', 'br'])}</div>
      <div className="poll-type">
        {lang(getPollTypeString(summary))}
        {renderRecentVoters()}
        {closePeriod > 0 && canVote && (
          <div ref={countdownRef} className="poll-countdown">
            <span>{formatMediaDuration(closePeriod)}</span>
            <svg width="16px" height="16px">
              <circle
                ref={timerCircleRef}
                cx="8"
                cy="8"
                r={TIMER_RADIUS}
                className="poll-countdown-progress"
                transform="rotate(-90, 8, 8)"
                stroke-dasharray={TIMER_CIRCUMFERENCE}
                stroke-dashoffset="0"
              />
            </svg>
          </div>
        )}
        {summary.quiz && poll.results.solution && !canVote && (
          <Button
            round
            size="tiny"
            color="translucent"
            className="poll-quiz-help"
            disabled={isSolutionShown}
            onClick={handleSolutionShow}
            ariaLabel="Show Solution"
          >
            <i className="icon icon-lamp" />
          </Button>
        )}
      </div>
      {canVote && (
        <div className="poll-answers" onClick={stopPropagation}>
          {isMultiple
            ? (
              <CheckboxGroup
                options={answers}
                onChange={handleCheckboxChange}
                disabled={message.isScheduled || isSubmitting}
                loadingOptions={isSubmitting ? chosenOptions : undefined}
                round
              />
            )
            : (
              <RadioGroup
                name={`poll-${messageId}`}
                options={answers}
                onChange={handleRadioChange}
                disabled={message.isScheduled || isSubmitting}
                loadingOption={isSubmitting ? chosenOptions[0] : undefined}
              />
            )}
        </div>
      )}
      {!canVote && (
        <div className="poll-results">
          {summary.answers.map(renderResultOption)}
        </div>
      )}
      {!canViewResult && !isMultiple && (
        <div className="poll-voters-count">{getReadableVotersCount(lang, summary.quiz, results.totalVoters)}</div>
      )}
      {isMultiple && (
        <Button
          isText
          disabled={chosenOptions.length === 0}
          size="tiny"
          onClick={handleVoteClick}
        >
          {lang('PollSubmitVotes')}
        </Button>
      )}
      {canViewResult && (
        <Button
          isText
          size="tiny"
          onClick={handleViewResultsClick}
        >
          {lang('PollViewResults')}
        </Button>
      )}
    </div>
  );
};

function getPollTypeString(summary: ApiPoll['summary']) {
  // When we just created the poll, some properties don't exist.
  if (typeof summary.isPublic === 'undefined') {
    return NBSP;
  }

  if (summary.closed) {
    return 'FinalResults';
  }

  if (summary.quiz) {
    return summary.isPublic ? 'QuizPoll' : 'AnonymousQuizPoll';
  }

  return summary.isPublic ? 'PublicPoll' : 'AnonymousPoll';
}

function getReadableVotersCount(lang: LangFn, isQuiz: true | undefined, count?: number) {
  if (!count) {
    return lang(isQuiz ? 'Chat.Quiz.TotalVotesEmpty' : 'Chat.Poll.TotalVotesResultEmpty');
  }

  return lang(isQuiz ? 'Answer' : 'Vote', count, 'i');
}

function stopPropagation(e: React.MouseEvent<HTMLDivElement>) {
  e.stopPropagation();
}

export default memo(withGlobal<OwnProps>(
  (global, { poll }) => {
    const { recentVoterIds } = poll.results;
    const { users: { byId: usersById } } = global;
    if (!recentVoterIds || recentVoterIds.length === 0) {
      return {};
    }

    return {
      recentVoterIds,
      usersById,
    };
  },
)(Poll));
