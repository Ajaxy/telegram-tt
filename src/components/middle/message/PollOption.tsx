import type { FC } from '../../../lib/teact/teact';
import React, {
  useEffect,
  useState,
} from '../../../lib/teact/teact';

import type { ApiPollAnswer, ApiPollResult } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import Icon from '../../common/icons/Icon';

import './PollOption.scss';

type OwnProps = {
  answer: ApiPollAnswer;
  voteResults?: ApiPollResult[];
  totalVoters?: number;
  maxVotersCount?: number;
  correctResults: string[];
  shouldAnimate: boolean;
};

const PollOption: FC<OwnProps> = ({
  answer,
  voteResults,
  totalVoters,
  maxVotersCount,
  correctResults,
  shouldAnimate,
}) => {
  const result = voteResults && voteResults.find((r) => r.option === answer.option);
  const correctAnswer = correctResults.length === 0 || correctResults.indexOf(answer.option) !== -1;
  const showIcon = (correctResults.length > 0 && correctAnswer) || (result?.isChosen);
  const answerPercent = result ? getPercentage(result.votersCount, totalVoters || 0) : 0;
  const [finalPercent, setFinalPercent] = useState(shouldAnimate ? 0 : answerPercent);
  const lineWidth = result ? getPercentage(result.votersCount, maxVotersCount || 0) : 0;
  const isAnimationDoesNotStart = finalPercent !== answerPercent;

  useEffect(() => {
    if (shouldAnimate) {
      setFinalPercent(answerPercent);
    }
  }, [shouldAnimate, answerPercent]);

  if (!voteResults || !result) {
    return undefined;
  }

  const lineStyle = `width: ${lineWidth}%; transform:scaleX(${isAnimationDoesNotStart ? 0 : 1})`;

  return (
    <div className="PollOption" dir="ltr">
      <div className={`poll-option-share ${answerPercent === '100' ? 'limit-width' : ''}`}>
        {answerPercent}%
        {showIcon && (
          <span className={buildClassName(
            'poll-option-chosen',
            !correctAnswer && 'wrong',
            shouldAnimate && 'animate',
          )}
          >
            <Icon name={correctAnswer ? 'check' : 'close'} className="poll-option-icon" />
          </span>
        )}
      </div>
      <div className="poll-option-right">
        <div className="poll-option-text" dir="auto">
          {renderTextWithEntities({
            text: answer.text.text,
            entities: answer.text.entities,
          })}
        </div>
        <div className={buildClassName('poll-option-answer', showIcon && !correctAnswer && 'wrong')}>
          {shouldAnimate && (
            <svg
              className="poll-line"
              style={!isAnimationDoesNotStart ? 'stroke-dasharray: 100% 200%; stroke-dashoffset: -44' : ''}
            >
              <path d="M4.47 5.33v13.6a9 9 0 009 9h13" />
            </svg>
          )}
          <div
            className="poll-option-line"
            style={lineStyle}
          />
        </div>
      </div>
    </div>
  );
};

function getPercentage(value: number, total: number) {
  return total > 0 ? ((value / total) * 100).toFixed() : 0;
}

export default PollOption;
