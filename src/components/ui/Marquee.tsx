import type React from '../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useLastCallback from '../../hooks/useLastCallback';
import useResizeObserver from '../../hooks/useResizeObserver';

import styles from './Marquee.module.scss';

const DEFAULT_SPEED = 40;

type AnimationState = {
  isAnimating: boolean;
  hasAnimationDelay: boolean;
};

type MarqueeSize = {
  isOverflowing: boolean;
  distance: number;
};

type StartAnimationOptions = {
  shouldForce?: boolean;
  shouldDelay?: boolean;
};

type OwnProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  paused?: boolean;
  style?: string;
  speed?: number;
};

const INITIAL_ANIMATION_STATE: AnimationState = {
  isAnimating: false,
  hasAnimationDelay: false,
};

const INITIAL_MARQUEE_SIZE: MarqueeSize = {
  isOverflowing: false,
  distance: 0,
};

const Marquee = ({
  children,
  className,
  contentClassName,
  paused,
  style,
  speed = DEFAULT_SPEED,
}: OwnProps) => {
  const rootRef = useRef<HTMLSpanElement>();
  const contentRef = useRef<HTMLSpanElement>();
  const copyRef = useRef<HTMLSpanElement>();
  const [marqueeSize, setMarqueeSize] = useState(INITIAL_MARQUEE_SIZE);
  const [animationState, setAnimationState] = useState(INITIAL_ANIMATION_STATE);
  const restartAnimationFrameRef = useRef<number>();
  const hasAutoStartedRef = useRef(false);

  const { isOverflowing, distance } = marqueeSize;
  const { isAnimating, hasAnimationDelay } = animationState;
  const isPaused = Boolean(paused);
  const duration = distance ? (distance / speed) * 1000 : 0;

  const startAnimation = useLastCallback((options?: StartAnimationOptions) => {
    const shouldForce = Boolean(options?.shouldForce);
    const shouldDelay = Boolean(options?.shouldDelay);

    if ((!shouldForce && (!isOverflowing || isAnimating)) || !selectCanAnimateInterface(getGlobal())) {
      return;
    }

    if (restartAnimationFrameRef.current) {
      cancelAnimationFrame(restartAnimationFrameRef.current);
    }

    setAnimationState({
      isAnimating: false,
      hasAnimationDelay: shouldDelay,
    });
    restartAnimationFrameRef.current = requestAnimationFrame(() => {
      restartAnimationFrameRef.current = undefined;
      setAnimationState((current) => ({
        isAnimating: true,
        hasAnimationDelay: current.hasAnimationDelay,
      }));
    });
  });

  const startAutoAnimation = useLastCallback(() => {
    if (hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    startAnimation({ shouldForce: true, shouldDelay: true });
  });

  const measureOverflow = useLastCallback(() => {
    requestMeasure(() => {
      if (!rootRef.current || !contentRef.current) return;

      const rootElement = rootRef.current;
      const contentElement = contentRef.current;
      const copyElement = copyRef.current;
      const nextContainerWidth = rootElement.clientWidth;
      const nextContentWidth = contentElement.scrollWidth;
      const nextOverflowDistance = Math.ceil(nextContentWidth - nextContainerWidth);

      if (nextOverflowDistance <= 0) {
        if (restartAnimationFrameRef.current) {
          cancelAnimationFrame(restartAnimationFrameRef.current);
          restartAnimationFrameRef.current = undefined;
        }
        setMarqueeSize(INITIAL_MARQUEE_SIZE);
        setAnimationState(INITIAL_ANIMATION_STATE);
        return;
      }

      if (!copyElement || !rootElement.contains(copyElement)) {
        setMarqueeSize({ isOverflowing: true, distance: 0 });
        return;
      }

      const nextDistance = Math.abs(copyElement.offsetLeft - contentElement.offsetLeft);

      setMarqueeSize({ isOverflowing: true, distance: nextDistance });
      startAutoAnimation();
    });
  });

  useEffect(() => {
    if (restartAnimationFrameRef.current) {
      cancelAnimationFrame(restartAnimationFrameRef.current);
      restartAnimationFrameRef.current = undefined;
    }

    hasAutoStartedRef.current = false;
    setMarqueeSize(INITIAL_MARQUEE_SIZE);
    setAnimationState(INITIAL_ANIMATION_STATE);
    measureOverflow();
  }, [children, measureOverflow]);

  useEffect(() => {
    if (!isOverflowing || distance) {
      return;
    }

    measureOverflow();
  }, [distance, isOverflowing, measureOverflow]);

  useEffect(() => {
    return () => {
      if (restartAnimationFrameRef.current) {
        cancelAnimationFrame(restartAnimationFrameRef.current);
      }
    };
  }, []);

  useResizeObserver(rootRef, measureOverflow);
  useResizeObserver(contentRef, measureOverflow);

  const handleAnimationEnd = useLastCallback((e: React.AnimationEvent<HTMLElement>) => {
    if (e.animationName === styles.marqueeScroll) {
      setAnimationState(INITIAL_ANIMATION_STATE);
    }
  });

  const handleMouseEnter = useLastCallback(() => {
    startAnimation();
  });

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse') return;
    startAnimation();
  });

  const rootStyle = buildStyle(
    isOverflowing && `--_marquee-distance: ${distance}px`,
    isOverflowing && `--_marquee-duration: ${duration}ms`,
    style,
  );

  return (
    <span
      ref={rootRef}
      className={buildClassName(
        styles.root,
        isOverflowing && styles.overflowing,
        isAnimating && styles.animating,
        hasAnimationDelay && styles.delayed,
        isPaused && styles.paused,
        className,
      )}
      style={rootStyle}
      onMouseEnter={handleMouseEnter}
      onPointerDown={handlePointerDown}
    >
      <span
        ref={contentRef}
        className={buildClassName(styles.content, contentClassName)}
        onAnimationEnd={handleAnimationEnd}
      >
        {children}
      </span>
      {isOverflowing && (
        <span
          ref={copyRef}
          className={buildClassName(styles.content, styles.copy, contentClassName)}
          aria-hidden
        >
          {children}
        </span>
      )}
    </span>
  );
};

export default memo(Marquee);
