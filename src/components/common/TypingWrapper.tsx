import type { TeactNode } from '../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useUnmountCleanup,
} from '../../lib/teact/teact';

import type { ApiFormattedText } from '../../api/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';
import { REM } from './helpers/mediaDimensions';

import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from './AnimatedIconWithPreview';

import styles from './TypingWrapper.module.scss';

type OwnProps = {
  formattedText: ApiFormattedText;
  shouldAnimateMask?: boolean;
  shouldRenderPlaceholder: boolean;
  completionKey: number;
  renderText: (text: ApiFormattedText) => TeactNode;
  onCompleted?: NoneToVoidFunction;
};

const CHUNK_SIZE = 67;
const CHUNK_SPREAD_DURATION = 500;
const HEADWAY_DURATION = 750;
const PLACEHOLDER_SIZE = 1.25 * REM;
const SPREAD_CHARS = 20;
const PROGRESS_CSS_PROPERTY = '--typing-draft-progress';
const SPREAD_CSS_PROPERTY = '--typing-draft-spread';

try {
  window.CSS.registerProperty({
    name: PROGRESS_CSS_PROPERTY,
    syntax: '<percentage>',
    inherits: false,
    initialValue: '0%',
  });
} catch (_) {
  // Ignore duplicate registrations
}

function getRunningProgress(animation: Animation | undefined, baseProgress: number) {
  const timing = animation?.effect?.getComputedTiming().progress;
  if (typeof timing !== 'number') return baseProgress;
  return baseProgress + (100 - baseProgress) * timing;
}

const TypingWrapper = ({
  formattedText,
  shouldAnimateMask,
  shouldRenderPlaceholder,
  completionKey,
  renderText,
  onCompleted,
}: OwnProps) => {
  const ref = useRef<HTMLSpanElement>();
  const animationRef = useRef<Animation>();
  const progressRef = useRef(0);
  const prevRevealedRef = useRef(0);
  const fullTextRef = useRef('');

  const [revealedLength, setRevealedLength] = useState(0);
  const revealedLengthRef = useRef(0);
  const chunkTimerRef = useRef<number>();
  const completedKeyRef = useRef<string>();
  const prevFullTextRef = useRef('');

  const fullText = formattedText.text;
  fullTextRef.current = fullText;

  const stopAnimation = useLastCallback(() => {
    animationRef.current?.cancel();
    animationRef.current = undefined;
  });

  const maybeNotifyCompleted = useLastCallback(() => {
    const currentFullText = fullTextRef.current;
    const currentCompletionKey = `${completionKey}:${currentFullText}`;
    const isFullyRevealed = revealedLengthRef.current >= currentFullText.length;
    const isMaskCompleted = !shouldAnimateMask || progressRef.current >= 100;

    if (!isFullyRevealed || !isMaskCompleted || completedKeyRef.current === currentCompletionKey) {
      return;
    }

    completedKeyRef.current = currentCompletionKey;
    onCompleted?.();
  });

  const scheduleChunks = useLastCallback((from: number, to: number) => {
    window.clearTimeout(chunkTimerRef.current);

    const delta = to - from;
    if (delta <= 0) return;

    const numChunks = Math.ceil(delta / CHUNK_SIZE);
    const chunkInterval = numChunks > 1 ? CHUNK_SPREAD_DURATION / (numChunks - 1) : 0;

    let position = from;

    const addChunk = () => {
      position = Math.min(position + CHUNK_SIZE, to);
      revealedLengthRef.current = position;
      setRevealedLength(position);

      if (position < to) {
        chunkTimerRef.current = window.setTimeout(addChunk, chunkInterval);
      } else {
        chunkTimerRef.current = undefined;
      }
    };

    addChunk();
  });

  // --- Chunking: spread incoming text over time ---
  useEffect(() => {
    if (fullText === prevFullTextRef.current) return;
    prevFullTextRef.current = fullText;

    const fullLen = fullText.length;
    const revealed = revealedLengthRef.current;

    if (fullLen < revealed) {
      window.clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = undefined;
      stopAnimation();
      revealedLengthRef.current = fullLen;
      prevRevealedRef.current = fullLen;
      progressRef.current = 100;
      setRevealedLength(fullLen);

      requestMutation(() => {
        const element = ref.current;
        if (!element) return;

        element.style.setProperty(SPREAD_CSS_PROPERTY, '0%');
        element.style.setProperty(PROGRESS_CSS_PROPERTY, '100%');
      });
      return;
    }

    if (fullLen === revealed) {
      return;
    }

    scheduleChunks(revealed, fullLen);
  }, [fullText, scheduleChunks, stopAnimation]);

  // Completion depends on several refs, so we are calling check after every render to avoid locking the UI
  useEffect(() => {
    maybeNotifyCompleted();
  });

  // --- Mask animation: smooth reveal of rendered content (layout effect to prevent flash) ---
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const revealed = revealedLength;
    const prevRevealed = prevRevealedRef.current;
    if (revealed === prevRevealed) return;

    prevRevealedRef.current = revealed;

    if (!shouldAnimateMask) {
      stopAnimation();
      progressRef.current = 100;
      element.style.setProperty(PROGRESS_CSS_PROPERTY, '100%');
      return;
    }

    let progress = animationRef.current
      ? getRunningProgress(animationRef.current, progressRef.current)
      : progressRef.current;

    stopAnimation();

    if (revealed < prevRevealed) {
      progress = 0;
    } else if (prevRevealed && revealed) {
      progress = Math.min((prevRevealed * progress) / revealed, 100);
    } else if (!prevRevealed) {
      progress = 0;
    }

    if (!revealed) {
      progress = 100;
    }

    progressRef.current = progress;
    const remaining = 100 - progress;
    const spread = revealed ? (SPREAD_CHARS / revealed) * 100 : 0;

    if (!revealed || remaining <= 0) {
      progressRef.current = 100;
      element.style.setProperty(PROGRESS_CSS_PROPERTY, '100%');
      return;
    }

    element.style.setProperty(SPREAD_CSS_PROPERTY, `${spread}%`);
    element.style.setProperty(PROGRESS_CSS_PROPERTY, `${progress}%`);

    const animation = element.animate([
      { [PROGRESS_CSS_PROPERTY]: `${progress}%` },
      { [PROGRESS_CSS_PROPERTY]: '100%' },
    ] as Keyframe[], {
      duration: HEADWAY_DURATION,
      easing: 'linear',
      fill: 'forwards',
    });

    animationRef.current = animation;

    animation.onfinish = () => {
      if (animationRef.current !== animation) return;

      progressRef.current = 100;
      animationRef.current = undefined;

      requestMutation(() => {
        element.style.setProperty(PROGRESS_CSS_PROPERTY, '100%');
      });

      maybeNotifyCompleted();
    };

    animation.oncancel = () => {
      if (animationRef.current !== animation) return;
      animationRef.current = undefined;
    };
  });

  useUnmountCleanup(() => {
    window.clearTimeout(chunkTimerRef.current);
    stopAnimation();
  });

  const truncatedText = useMemo(() => ({
    text: fullText.slice(0, revealedLength),
    entities: formattedText.entities,
  }), [fullText, formattedText.entities, revealedLength]);

  return (
    <span ref={ref} className={styles.root}>
      {renderText(truncatedText)}
      {shouldRenderPlaceholder && (
        <span key="typing-placeholder" className={styles.placeholder}>
          <AnimatedIconWithPreview
            tgsUrl={LOCAL_TGS_URLS.Writing}
            size={PLACEHOLDER_SIZE}
            play
            noLoop={false}
            shouldUseTextColor
          />
        </span>
      )}
    </span>
  );
};

export default memo(TypingWrapper);
