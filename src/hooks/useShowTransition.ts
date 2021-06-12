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
  const [hasOpenClassName, setHasOpenClassName] = useState(isOpen && noOpenTransition);

  if (isOpen) {
    setIsClosed(false);
    setHasOpenClassName(true);

    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }
  } else {
    setHasOpenClassName(false);

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

  const isClosing = Boolean(closeTimeoutRef.current);
  const shouldRender = isOpen || isClosing;
  const transitionClassNames = buildClassName(
    className && 'opacity-transition',
    className,
    ((hasOpenClassName && !noCloseTransition) || (noCloseTransition && isOpen)) && 'open',
    shouldRender && 'shown',
    isClosing && 'closing',
  );

  return {
    shouldRender,
    transitionClassNames,
  };
};
