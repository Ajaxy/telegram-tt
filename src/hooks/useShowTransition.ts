import { useRef, useState } from '../lib/teact/teact';
import buildClassName from '../util/buildClassName';

const CLOSE_DURATION = 350;

export default (
  isOpen = false,
  onCloseTransitionEnd?: () => void,
  noOpenTransition = false,
  className: string | false = 'fast',
  noCloseTransition = false,
) => {
  const [isClosed, setIsClosed] = useState(!isOpen);
  const closeTimeoutRef = useRef<number>();
  // СSS class should be added in a separate tick to turn on CSS transition.
  const [hasAsyncOpenClassName, setHasAsyncOpenClassName] = useState(false);

  if (isOpen) {
    setIsClosed(false);
    setHasAsyncOpenClassName(true);

    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }
  } else {
    setHasAsyncOpenClassName(false);

    if (!isClosed && !closeTimeoutRef.current) {
      closeTimeoutRef.current = window.setTimeout(() => {
        setIsClosed(true);

        if (onCloseTransitionEnd) {
          onCloseTransitionEnd();
        }

        closeTimeoutRef.current = undefined;
      }, noCloseTransition ? 0 : CLOSE_DURATION);
    }
  }

  const hasOpenClassName = hasAsyncOpenClassName || (isOpen && noOpenTransition);
  const isClosing = Boolean(closeTimeoutRef.current);
  const shouldRender = isOpen || isClosing;
  const transitionClassNames = buildClassName(
    className && 'opacity-transition',
    className,
    hasOpenClassName && 'open',
    shouldRender && 'shown',
    isClosing && 'closing',
  );

  return {
    shouldRender,
    transitionClassNames,
  };
};
