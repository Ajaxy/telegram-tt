import { useEffect, useRef, useState } from 'react';

import buildClassName from '../util/buildClassName';

const CLOSE_DURATION = 350;

const useShowTransition = (
  isOpen = false,
  onCloseTransitionEnd?: () => void,
  noFirstOpenTransition = false,
  className: string | false = 'fast',
  noCloseTransition = false,
  closeDuration = CLOSE_DURATION,
  noOpenTransition = false,
) => {
  const [isClosed, setIsClosed] = useState(!isOpen);
  const closeTimeoutRef = useRef<number>();
  // СSS class should be added in a separate tick to turn on CSS transition.
  const [hasOpenClassName, setHasOpenClassName] = useState(isOpen && noFirstOpenTransition);

  useEffect(() => {
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
        const exec = () => {
          setIsClosed(true);

          if (onCloseTransitionEnd) {
            onCloseTransitionEnd();
          }

          closeTimeoutRef.current = undefined;
        };

        if (noCloseTransition) {
          exec();
        } else {
          closeTimeoutRef.current = window.setTimeout(exec, closeDuration);
        }
      }
    }
  }, [closeDuration, isClosed, isOpen, noCloseTransition, onCloseTransitionEnd]);

  // `noCloseTransition`, when set to true, should remove the open class immediately
  const shouldHaveOpenClassName = (hasOpenClassName && !(noCloseTransition && !isOpen)) || (noOpenTransition && isOpen);
  const isClosing = Boolean(closeTimeoutRef.current);
  const shouldRender = isOpen || isClosing;
  const transitionClassNames = buildClassName(
    className && 'opacity-transition',
    className,
    shouldHaveOpenClassName && 'open',
    !shouldHaveOpenClassName && 'not-open',
    shouldRender && 'shown',
    !shouldRender && 'not-shown',
    isClosing && 'closing',
  );

  return {
    shouldRender,
    transitionClassNames,
    hasShownClass: shouldRender,
    hasOpenClass: shouldHaveOpenClassName,
    isClosing,
  };
};

export default useShowTransition;
