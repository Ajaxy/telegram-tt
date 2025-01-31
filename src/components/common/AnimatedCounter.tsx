import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { throttleWithTickEnd } from '../../util/schedulers';

import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import styles from './AnimatedCounter.module.scss';

type OwnProps = {
  text: string;
  className?: string;
  isDisabled?: boolean;
  ref?: React.RefObject<HTMLSpanElement>;
};

const ANIMATION_TIME = 200;
const MAX_SIMULTANEOUS_ANIMATIONS = 10;

let scheduledAnimationsCounter = 0;

const resetCounterOnTickEnd = throttleWithTickEnd(() => {
  scheduledAnimationsCounter = 0;
});

const AnimatedCounter: FC<OwnProps> = ({
  text,
  className,
  isDisabled,
  ref,
}) => {
  const { isRtl } = useLang();

  const prevText = usePreviousDeprecated(text);
  const forceUpdate = useForceUpdate();

  const shouldAnimate = scheduleAnimation(
    !isDisabled && selectCanAnimateInterface(getGlobal()) && prevText !== undefined && prevText !== text,
  );

  const characters = useMemo(() => {
    return shouldAnimate ? renderAnimatedCharacters(text, prevText) : text;
  }, [shouldAnimate, prevText, text]);

  useEffect(() => {
    if (!shouldAnimate) return undefined;

    const timeoutId = window.setTimeout(() => {
      forceUpdate();
    }, ANIMATION_TIME);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [shouldAnimate, text]);

  return (
    <span ref={ref} className={buildClassName(className, !isDisabled && styles.root)} dir={isRtl ? 'rtl' : undefined}>
      {characters}
    </span>
  );
};

export default memo(AnimatedCounter);

function scheduleAnimation(condition: boolean) {
  if (!condition || scheduledAnimationsCounter >= MAX_SIMULTANEOUS_ANIMATIONS) return false;

  if (scheduledAnimationsCounter === 0) {
    resetCounterOnTickEnd();
  }

  scheduledAnimationsCounter++;

  return true;
}

function renderAnimatedCharacters(text: string, prevText?: string) {
  const elements: React.ReactNode[] = [];
  const textLength = text.length;
  const prevTextLength = prevText?.length ?? 0;

  for (let i = 0; i <= textLength; i++) {
    const charIndex = textLength - i;
    const prevTextCharIndex = prevTextLength - i;

    if (prevText && prevTextCharIndex >= 0 && text[charIndex] !== prevText[prevTextCharIndex]) {
      elements.unshift(
        <div className={styles.characterContainer}>
          <div className={styles.character}>{text[charIndex] ?? ''}</div>
          <div className={styles.characterOld}>{prevText[prevTextCharIndex]}</div>
          <div className={styles.characterNew}>{text[charIndex] ?? ''}</div>
        </div>,
      );
    } else {
      elements.unshift(<span>{text[charIndex] ?? ''}</span>);
    }
  }

  return elements;
}
