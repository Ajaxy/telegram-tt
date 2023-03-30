import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import { ANIMATION_LEVEL_MAX } from '../../config';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import styles from './AnimatedCounter.module.scss';

type OwnProps = {
  text: string;
};

const AnimatedCounter: FC<OwnProps> = ({
  text,
}) => {
  const lang = useLang();

  const prevTextRef = useRef<string>();
  const [isAnimating, markAnimating, unmarkAnimating] = useFlag(false);

  const shouldAnimate = getGlobal().settings.byKey.animationLevel === ANIMATION_LEVEL_MAX;

  const textElement = useMemo(() => {
    if (!shouldAnimate) {
      return text;
    }
    if (!isAnimating) {
      return prevTextRef.current || text;
    }

    const prevText = prevTextRef.current;

    const elements = [];
    for (let i = 0; i < text.length; i++) {
      if (prevText && text[i] !== prevText[i]) {
        elements.push(
          <div className={styles.characterContainer}>
            <div className={styles.character}>{text[i]}</div>
            <div className={styles.characterOld} onAnimationEnd={unmarkAnimating}>{prevText[i]}</div>
            <div className={styles.characterNew} onAnimationEnd={unmarkAnimating}>{text[i]}</div>
          </div>,
        );
      } else {
        elements.push(<span>{text[i]}</span>);
      }
    }

    prevTextRef.current = text;

    return elements;
  }, [shouldAnimate, isAnimating, text]);

  useEffect(() => {
    markAnimating();
  }, [text]);

  return (
    <span className={styles.root} dir={lang.isRtl ? 'rtl' : undefined}>
      {textElement}
    </span>
  );
};

export default AnimatedCounter;
