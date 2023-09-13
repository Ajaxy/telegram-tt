import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import styles from './AnimatedCounter.module.scss';

type OwnProps = {
  text: string;
  className?: string;
};

const AnimatedCounter: FC<OwnProps> = ({
  text,
  className,
}) => {
  const lang = useLang();

  const prevTextRef = useRef<string>();
  const [isAnimating, markAnimating, unmarkAnimating] = useFlag(false);

  const shouldAnimate = selectCanAnimateInterface(getGlobal());

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
    <span className={buildClassName(styles.root, className)} dir={lang.isRtl ? 'rtl' : undefined}>
      {textElement}
    </span>
  );
};

export default AnimatedCounter;
