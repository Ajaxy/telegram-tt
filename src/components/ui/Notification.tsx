import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';

import { ANIMATION_END_DELAY } from '../../config';
import useShowTransition from '../../hooks/useShowTransition';
import { TextPart } from '../common/helpers/renderMessageText';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import Portal from './Portal';

import './Notification.scss';

type OwnProps = {
  message: TextPart[];
  duration?: number;
  onDismiss: () => void;
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 150;

const Notification: FC<OwnProps> = ({ message, duration = DEFAULT_DURATION, onDismiss }) => {
  const [isOpen, setIsOpen] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const timerRef = useRef<number | undefined>(null);

  const { transitionClassNames } = useShowTransition(isOpen);

  const closeAndDismiss = useCallback(() => {
    setIsOpen(false);
    setTimeout(onDismiss, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [onDismiss]);

  useEffect(() => (isOpen ? captureEscKeyListener(closeAndDismiss) : undefined), [isOpen, closeAndDismiss]);

  useEffect(() => {
    timerRef.current = window.setTimeout(closeAndDismiss, duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [duration, closeAndDismiss]);

  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    timerRef.current = window.setTimeout(closeAndDismiss, duration);
  }, [duration, closeAndDismiss]);

  return (
    <Portal className="Notification-container" containerId="#middle-column-portals">
      <div
        className={buildClassName('Notification', transitionClassNames)}
        onClick={closeAndDismiss}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="content">
          {message}
        </div>
      </div>
    </Portal>
  );
};

export default memo(Notification);
