import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type {
  ApiMessage, ApiPeer, ApiPoll, ApiPollAnswer,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { OldLangFn } from '../../../hooks/useOldLang';

import { selectPeer } from '../../../global/selectors';
import { formatMediaDuration } from '../../../util/dates/dateFormat';
import { getMessageKey } from '../../../util/keys/messageKey';
import { getServerTime } from '../../../util/serverTime';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AvatarList from '../../common/AvatarList';
import Button from '../../ui/Button';
import CheckboxGroup from '../../ui/CheckboxGroup';
import RadioGroup from '../../ui/RadioGroup';
import PollOption from './PollOption';

import './Poll.scss';

type OwnProps = {
  message: ApiMessage;
  poll: ApiPoll;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onSendVote: (options: string[]) => void;
};

const SOLUTION_CONTAINER_ID = '#middle-column-portals';
const SOLUTION_DURATION = 5000;
const TIMER_RADIUS = 6;
const TIMER_CIRCUMFERENCE = TIMER_RADIUS * 2 * Math.PI;
const TIMER_UPDATE_INTERVAL = 1000;
const NBSP = '\u00A0';

const Poll: FC<OwnProps> = ({
  message,
  poll,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onSendVote,
}) => {
  const {
    loadMessage, openPollResults, requestConfetti, showNotification,
  } = getActions();

  const { id: messageId, chatId } = message;
  const { summary, results } = poll;
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [chosenOptions, setChosenOptions] = useState<string[]>([]);
  const [wasSubmitted, setWasSubmitted] = useState<boolean>(false);
  const [closePeriod, setClosePeriod] = useState<number>(() => (
    !summary.closed && summary.closeDate && summary.closeDate > 0
      ? Math.min(summary.closeDate - getServerTime(), summary.closePeriod!)
      : 0
  ));
  const countdownRef = useRef<HTMLDivElement>();
  const timerCircleRef = useRef<SVGCircleElement>();
  const { results: voteResults, totalVoters } = results;
  const hasVoted = voteResults && voteResults.some((r) => r.isChosen);
  const canVote = !summary.closed && !hasVoted;
  const canViewResult = !canVote && summary.isPublic && Number(results.totalVoters) > 0;
  const isMultiple = canVote && summary.multipleChoice;
  const recentVoterIds = results.recentVoterIds;
  const maxVotersCount = voteResults ? Math.max(...voteResults.map((r) => r.votersCount)) : totalVoters;
  const correctResults = useMemo(() => {
    return voteResults?.filter((r) => r.isCorrect).map((r) => r.option) || [];
  }, [voteResults]);
  const answers = useMemo(() => summary.answers.map((a) => ({
    label: renderTextWithEntities({
      text: a.text.text,
      entities: a.text.entities,
      observeIntersectionForLoading,
      observeIntersectionForPlaying,
    }),
    value: a.option,
    hidden: Boolean(summary.quiz && summary.closePeriod && closePeriod <= 0),
  })), [
    closePeriod, observeIntersectionForLoading, observeIntersectionForPlaying,
    summary.answers, summary.closePeriod, summary.quiz,
  ]);

  useEffect(() => {
    const chosen = poll.results.results?.find((result) => result.isChosen);
    if (isSubmitting && chosen) {
      if (chosen.isCorrect) {
        requestConfetti({});
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
    const global = getGlobal();
    return recentVoterIds ? recentVoterIds.reduce((result: ApiPeer[], id) => {
      const peer = selectPeer(global, id);
      if (peer) {
        result.push(peer);
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

  const showSolution = useLastCallback(() => {
    showNotification({
      localId: getMessageKey(message),
      message: renderTextWithEntities({ text: poll.results.solution!, entities: poll.results.solutionEntities }),
      duration: SOLUTION_DURATION,
      containerSelector: SOLUTION_CONTAINER_ID,
    });
  });

  // Show the solution to quiz if the answer was incorrect
  useEffect(() => {
    if (wasSubmitted && hasVoted && summary.quiz && results.results && poll.results.solution) {
      const correctResult = results.results.find((r) => r.isChosen && r.isCorrect);
      if (!correctResult) {
        showSolution();
      }
    }
  }, [hasVoted, wasSubmitted, results.results, summary.quiz, poll.results.solution]);

  const lang = useOldLang();

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
          <AvatarList
            size="micro"
            peers={recentVoters}
          />
        </div>
      )
    );
  }

  return (
    <div className="Poll" dir={lang.isRtl ? 'auto' : 'ltr'}>
      <div className="poll-question">
        {renderTextWithEntities({
          text: summary.question.text,
          entities: summary.question.entities,
          observeIntersectionForLoading,
          observeIntersectionForPlaying,
        })}
      </div>
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
            onClick={showSolution}
            ariaLabel="Show Solution"
            iconName="lamp"
          />
        )}
      </div>
      {canVote && (
        <div
          className="poll-answers"
          onClick={stopPropagation}
        >
          {isMultiple
            ? (
              <CheckboxGroup
                options={answers}
                selected={chosenOptions}
                onChange={handleCheckboxChange}
                disabled={message.isScheduled || isSubmitting}
                loadingOptions={isSubmitting ? chosenOptions : undefined}
                isRound
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

function getReadableVotersCount(lang: OldLangFn, isQuiz: true | undefined, count?: number) {
  if (!count) {
    return lang(isQuiz ? 'Chat.Quiz.TotalVotesEmpty' : 'Chat.Poll.TotalVotesResultEmpty');
  }

  return lang(isQuiz ? 'Answer' : 'Vote', count, 'i');
}

function stopPropagation(e: React.MouseEvent<HTMLDivElement>) {
  e.stopPropagation();
}

export default memo(Poll);
