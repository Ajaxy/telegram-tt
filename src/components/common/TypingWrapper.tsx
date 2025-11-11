import {
  memo, useEffect, useRef, useSignal, useUnmountCleanup,
} from '../../lib/teact/teact';

import {
  type ApiFormattedText,
} from '../../api/types';

import useDerivedState from '../../hooks/useDerivedState';
import useLastCallback from '../../hooks/useLastCallback';

type OwnProps = {
  text: ApiFormattedText;
  duration?: number;
  children: (text: ApiFormattedText) => React.ReactNode;
};

const DEFAULT_HEADWAY_DURATION = 1000;
const MIN_TIMEOUT_DURATION = 1000 / 60; // 60 FPS
const MAX_SYMBOLS_BATCH = 10;

const TypingWrapper = ({
  text,
  duration = DEFAULT_HEADWAY_DURATION,
  children,
}: OwnProps) => {
  const [getCurrentTextLength, setCurrentTextLength] = useSignal(text.text.length);
  const intervalRef = useRef<number>();

  const animate = useLastCallback(() => {
    const msPerSymbol = duration / text.text.length;
    const timeoutDuration = Math.max(msPerSymbol, MIN_TIMEOUT_DURATION);
    const nextSymbolBatchLength = Math.min(Math.ceil(timeoutDuration / msPerSymbol), MAX_SYMBOLS_BATCH);

    intervalRef.current = window.setTimeout(() => {
      if (getCurrentTextLength() >= text.text.length) {
        clearTimeout(intervalRef.current);
        return;
      }

      setCurrentTextLength(getCurrentTextLength() + nextSymbolBatchLength);
    }, timeoutDuration);
  });

  useEffect(() => {
    // Text got shorter, skip animation
    if (text.text.length < getCurrentTextLength()) {
      clearTimeout(intervalRef.current);
      setCurrentTextLength(text.text.length);
      return;
    }

    clearTimeout(intervalRef.current);
    animate();
  }, [getCurrentTextLength, setCurrentTextLength, text.text.length]);

  useUnmountCleanup(() => {
    clearTimeout(intervalRef.current);
  });

  const displayedText = useDerivedState(() => {
    return {
      ...text,
      text: text.text.slice(0, getCurrentTextLength()),
    };
  }, [getCurrentTextLength, text]);

  return children(displayedText);
};

export default memo(TypingWrapper);
