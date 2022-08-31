import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';

import type { TextPart } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import useShowTransition from '../../hooks/useShowTransition';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import Portal from './Portal';
import Button from './Button';

import './Notification.scss';

type OwnProps = {
  title?: TextPart[];
  containerId?: string;
  message: TextPart[];
  duration?: number;
  onDismiss: () => void;
  action?: VoidFunction;
  actionText?: string;
  className?: string;
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 150;

const Notification: FC<OwnProps> = ({
  title, className,
  message, duration = DEFAULT_DURATION, containerId, onDismiss,
  action, actionText,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const timerRef = useRef<number | undefined>(null);
  const { transitionClassNames } = useShowTransition(isOpen);

  const closeAndDismiss = useCallback(() => {
    setIsOpen(false);
    setTimeout(onDismiss, ANIMATION_DURATION + ANIMATION_END_DELAY);
  }, [onDismiss]);

  function handleClick() {
    action?.();
    closeAndDismiss();
  }

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
    <Portal className="Notification-container" containerId={containerId}>
      <div
        className={buildClassName('Notification', transitionClassNames, className)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="content">
          {title && <div className="notification-title">{title}</div>}
          {message}
        </div>
        {action && actionText && (
          <Button
            color="translucent-white"
            onClick={action}
            className="Notification-button"
          >
            {actionText}
          </Button>
        )}
      </div>
    </Portal>
  );
};

export default Notification;
