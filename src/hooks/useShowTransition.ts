import { useRef, useState } from '../lib/teact/teact';
import buildClassName from '../util/buildClassName';

const CLOSE_DURATION = 350;

const useShowTransition = (
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
        closeTimeoutRef.current = window.setTimeout(exec, CLOSE_DURATION);
      }
    }
  }

  // `noCloseTransition`, when set to true, should remove the open class immediately
  const shouldHaveOpenClassName = hasOpenClassName && !(noCloseTransition && !isOpen);
  const isClosing = Boolean(closeTimeoutRef.current);
  const shouldRender = isOpen || isClosing;
  const transitionClassNames = buildClassName(
    className && 'opacity-transition',
    className,
    shouldHaveOpenClassName && 'open',
    shouldRender && 'shown',
    isClosing && 'closing',
  );

  return {
    shouldRender,
    transitionClassNames,
  };
};

export default useShowTransition;
