import {
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
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import StarIcon from '../common/icons/StarIcon';
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

const Notification = ({
  notification,
}: OwnProps) => {
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
    shouldUseCustomIcon,
    customEmojiIconId,
    shouldShowTimer,
    title,
    containerSelector,
  } = notification;

  const isMessageLangFnParam = isLangFnParam(message);

  const [isOpen, setIsOpen] = useState(true);
  const actionActivationRef = useRef<boolean>(false);
  const timerRef = useRef<number | undefined>();
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

  const handleActionClick = useLastCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (action && !actionActivationRef.current) {
      actionActivationRef.current = true;
      if (Array.isArray(action)) {
        // @ts-ignore
        action.forEach((cb) => actions[cb.action](cb.payload));
      } else {
        // @ts-ignore
        actions[action.action](action.payload);
      }
    }
    if (disableClickDismiss) {
      setIsOpen(false);
      setTimeout(handleDismiss, ANIMATION_DURATION + ANIMATION_END_DELAY);
    }
    closeAndDismiss();
  });

  const handleClick = useLastCallback(() => {
    if (action && !actionActivationRef.current) {
      actionActivationRef.current = true;
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
  // @ts-expect-error -- Lang Parameters are too complex
  }, [lang, title]);

  const renderedMessage = useMemo(() => {
    if (isMessageLangFnParam) {
      return lang.with(message);
    }

    if (typeof message === 'string') {
      if (notification.messageEntities) {
        return renderTextWithEntities({
          text: message,
          entities: notification.messageEntities,
        });
      }
      return renderText(message, ['simple_markdown', 'emoji', 'br', 'links']);
    }

    return message;
  // @ts-expect-error -- Lang Parameters are too complex
  }, [isMessageLangFnParam, lang, message, notification.messageEntities]);

  const renderedActionText = useMemo(() => {
    if (!actionText) return undefined;
    if (isLangFnParam(actionText)) {
      return lang.with(actionText);
    }

    return actionText;
  }, [lang, actionText]);

  const renderedIcon = useMemo(() => {
    if (customEmojiIconId) {
      return (
        <CustomEmoji
          className="notification-emoji-icon"
          forceAlways
          size={CUSTOM_EMOJI_SIZE}
          documentId={customEmojiIconId}
        />
      );
    }

    if (shouldUseCustomIcon) {
      if (icon === 'star') {
        return (
          <StarIcon type="gold" className={buildClassName('notification-icon')} size="adaptive" />
        );
      }
    }
    return <Icon name={icon || 'info-filled'} className="notification-icon" />;
  }, [customEmojiIconId, icon, shouldUseCustomIcon]);

  return (
    <Portal className="Notification-container" containerSelector={containerSelector}>
      <div
        className={buildClassName('Notification', transitionClassNames, className)}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {renderedIcon}
        <div className="content">
          {Boolean(renderedTitle) && (
            <div className="notification-title">{renderedTitle}</div>
          )}
          {renderedMessage}
        </div>
        {Boolean(renderedActionText) && (
          <Button
            color="translucent-white"
            onClick={handleActionClick}
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
