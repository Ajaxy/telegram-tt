import type { FC, TeactNode } from '../../lib/teact/teact';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { CallbackAction } from '../../global/types';
import type { IconName } from '../../types/icons';

import { ANIMATION_END_DELAY } from '../../config';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import useLastCallback from '../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import Icon from '../common/icons/Icon';
import Button from './Button';
import Portal from './Portal';
import RoundTimer from './RoundTimer';

import './Notification.scss';

type OwnProps = {
  title?: TeactNode;
  containerId?: string;
  message: TeactNode;
  duration?: number;
  action?: CallbackAction | CallbackAction[];
  actionText?: string;
  className?: string;
  icon?: IconName;
  shouldDisableClickDismiss?: boolean;
  dismissAction?: CallbackAction;
  shouldShowTimer?: boolean;
  cacheBreaker?: string;
  onDismiss: NoneToVoidFunction;
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 150;

const Notification: FC<OwnProps> = ({
  title,
  className,
  message,
  duration = DEFAULT_DURATION,
  containerId,
  icon,
  action,
  actionText,
  shouldDisableClickDismiss,
  dismissAction,
  shouldShowTimer,
  cacheBreaker,
  onDismiss,
}) => {
  const actions = getActions();

  const [isOpen, setIsOpen] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const timerRef = useRef<number | undefined>(null);
  const { transitionClassNames } = useShowTransitionDeprecated(isOpen);

  const closeAndDismiss = useLastCallback((force?: boolean) => {
    if (!force && shouldDisableClickDismiss) return;
    setIsOpen(false);
    setTimeout(onDismiss, ANIMATION_DURATION + ANIMATION_END_DELAY);
    if (dismissAction) {
      // @ts-ignore
      actions[dismissAction.action](dismissAction.payload);
    }
  });

  const handleClick = useCallback(() => {
    if (action) {
      if (Array.isArray(action)) {
        // @ts-ignore
        action.forEach((cb) => actions[cb.action](cb.payload));
      } else {
        // @ts-ignore
        actions[action.action](action.payload);
      }
    }
    closeAndDismiss();
  }, [action, actions, closeAndDismiss]);

  useEffect(() => (isOpen ? captureEscKeyListener(closeAndDismiss) : undefined), [isOpen, closeAndDismiss]);

  useEffect(() => {
    timerRef.current = window.setTimeout(() => closeAndDismiss(true), duration);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = undefined;
      }
    };
  }, [duration, cacheBreaker]); // Reset timer if `cacheBreaker` changes

  const handleMouseEnter = useLastCallback(() => {
    if (shouldDisableClickDismiss) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  });

  const handleMouseLeave = useLastCallback(() => {
    if (shouldDisableClickDismiss) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(closeAndDismiss, duration);
  });

  return (
    <Portal className="Notification-container" containerId={containerId}>
      <div
        className={buildClassName('Notification', transitionClassNames, className)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Icon name={icon || 'info-filled'} className="notification-icon" />
        <div className="content">
          {title && <div className="notification-title">{title}</div>}
          {message}
        </div>
        {action && actionText && (
          <Button
            color="translucent-white"
            onClick={handleClick}
            className="notification-button"
          >
            {actionText}
          </Button>
        )}
        {shouldShowTimer && (
          <RoundTimer className="notification-timer" key={cacheBreaker} duration={Math.ceil(duration / 1000)} />
        )}
      </div>
    </Portal>
  );
};

export default Notification;
