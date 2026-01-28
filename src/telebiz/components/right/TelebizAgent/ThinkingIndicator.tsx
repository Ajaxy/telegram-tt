import { memo, useEffect, useState } from '../../../../lib/teact/teact';

import type { ThinkingState } from '../../../agent/types';

import styles from './ThinkingIndicator.module.scss';

interface OwnProps {
  thinking: ThinkingState;
}

const ThinkingIndicator = ({ thinking }: OwnProps) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!thinking.isThinking || !thinking.startedAt) {
      setElapsedSeconds(0);
      return undefined;
    }

    // Calculate initial elapsed time immediately
    const initialElapsed = Math.floor((Date.now() - thinking.startedAt) / 1000);
    setElapsedSeconds(initialElapsed);

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - thinking.startedAt!) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [thinking.isThinking, thinking.startedAt]);

  if (!thinking.isThinking) return undefined;

  // Get current step (last one) or default text
  const currentStep = thinking.currentStep || (thinking.steps.length > 0
    ? thinking.steps[thinking.steps.length - 1]
    : undefined);

  return (
    <div className={styles.thinkingIndicator}>
      <div className={styles.spinner} />
      <span className={styles.label}>
        {currentStep || 'Thinking'}
        {elapsedSeconds > 0 && ` for ${elapsedSeconds}s`}
        ...
      </span>
    </div>
  );
};

export default memo(ThinkingIndicator);
