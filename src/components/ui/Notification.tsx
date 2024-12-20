import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiNotification } from '../../api/types';
import { isLangFnParam } from '../../util/localization/types';

import { ANIMATION_END_DELAY } from '../../config';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { REM } from '../common/helpers/mediaDimensions';
import renderText from '../common/helpers/renderText';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import Button from './Button';
import Portal from './Portal';
import RoundTimer from './RoundTimer';

import './Notification.scss';

type OwnProps = {
  notification: ApiNotification;
};

const DEFAULT_DURATION = 3000;
const ANIMATION_DURATION = 150;
const CUSTOM_EMOJI_SIZE = 1.75 * REM;

const Notification: FC<OwnProps> = ({
  notification,
}) => {
  const actions = getActions();

  const lang = useLang();

  const {
    localId,
    message,
    action,
    actionText,
    cacheBreaker,
    className,
    disableClickDismiss,
    dismissAction,
    duration = DEFAULT_DURATION,
    icon,
    customEmojiIconId,
    shouldShowTimer,
    title,
    containerSelector,
  } = notification;

  const [isOpen, setIsOpen] = useState(true);
  // eslint-disable-next-line no-null/no-null
  const timerRef = useRef<number | undefined>(null);
  const { transitionClassNames } = useShowTransitionDeprecated(isOpen);

  const handleDismiss = useLastCallback(() => {
    actions.dismissNotification({ localId });
  });

  const closeAndDismiss = useLastCallback((force?: boolean) => {
    if (!force && disableClickDismiss) return;
    setIsOpen(false);
    setTimeout(handleDismiss, ANIMATION_DURATION + ANIMATION_END_DELAY);
    if (dismissAction) {
      // @ts-ignore
      actions[dismissAction.action](dismissAction.payload);
    }
  });

  const handleClick = useLastCallback(() => {
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
  });

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
    if (disableClickDismiss) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  });

  const handleMouseLeave = useLastCallback(() => {
    if (disableClickDismiss) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(closeAndDismiss, duration);
  });

  const renderedTitle = useMemo(() => {
    if (!title) return undefined;
    if (isLangFnParam(title)) {
      return lang.with(title);
    }

    return renderText(title, ['simple_markdown', 'emoji', 'br', 'links']);
  }, [lang, title]);

  const renderedMessage = useMemo(() => {
    if (isLangFnParam(message)) {
      return lang.with(message);
    }

    if (typeof message === 'string') {
      return renderText(message, ['simple_markdown', 'emoji', 'br', 'links']);
    }

    return message;
  }, [lang, message]);

  const renderedActionText = useMemo(() => {
    if (!actionText) return undefined;
    if (isLangFnParam(actionText)) {
      return lang.with(actionText);
    }

    return actionText;
  }, [lang, actionText]);

  return (
    <Portal className="Notification-container" containerSelector={containerSelector}>
      <div
        className={buildClassName('Notification', transitionClassNames, className)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {customEmojiIconId ? (
          <CustomEmoji
            className="notification-emoji-icon"
            forceAlways
            size={CUSTOM_EMOJI_SIZE}
            documentId={customEmojiIconId}
          />
        ) : (
          <Icon name={icon || 'info-filled'} className="notification-icon" />
        )}
        <div className="content">
          {renderedTitle && (
            <div className="notification-title">{renderedTitle}</div>
          )}
          {renderedMessage}
        </div>
        {action && renderedActionText && (
          <Button
            color="translucent-white"
            onClick={handleClick}
            className="notification-button"
          >
            {renderedActionText}
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
