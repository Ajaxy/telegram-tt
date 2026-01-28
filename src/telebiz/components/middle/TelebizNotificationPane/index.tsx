import { memo, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';
import { selectTelebizPendingNotificationsByChatId } from '../../../global';

import type { ApiChat } from '../../../../api/types';
import type { Notification } from '../../../services/types';
import { NotificationType } from '../../../services/types';

import { selectChat, selectChatMessage } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatPastDatetime } from '../../../../util/dates/dateFormat';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';

import useHeaderPane, { type PaneState } from '../../../../components/middle/hooks/useHeaderPane';
import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../../components/common/icons/Icon';
import MessageSummary from '../../../../components/common/MessageSummary';
import Button from '../../../../components/ui/Button';
import DropdownMenu from '../../../../components/ui/DropdownMenu';
import MenuItem from '../../../../components/ui/MenuItem';
import { TimeIcon } from '../../icons/Notifications';

import styles from './TelebizNotificationPane.module.scss';

const SNOOZE_OPTIONS = [
  { label: '15 minutes', minutes: 15 },
  { label: '1 hour', minutes: 60 },
  { label: '4 hours', minutes: 240 },
  { label: 'Tomorrow', minutes: 1440 },
];

const QUICK_REPLIES = [
  'Hey, just following up here',
  'Any updates on this?',
  'Checking in on this',
  'Got it, thanks!',
];

type OwnProps = {
  chatId: string;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  notifications: Notification[];
  chat?: ApiChat;
};

const TelebizNotificationPane = ({
  chatId,
  notifications,
  chat,
  onPaneStateChange,
}: OwnProps & StateProps) => {
  const {
    focusMessage,
    dismissTelebizNotification,
    snoozeTelebizNotification,
    openChatWithDraft,
  } = getActions();

  const lang = useLang();
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0);

  const currentNotification = notifications[currentNotificationIndex];
  const messageId = currentNotification?.metadata?.message_id
    ? Number(currentNotification.metadata.message_id)
    : undefined;

  const message = useMemo(
    () => messageId ? selectChatMessage(getGlobal(), chatId, messageId) : undefined,
    [chatId, messageId],
  );

  useEnsureMessage(chatId, messageId, message);

  const isRendering = notifications.length > 0;

  const { ref, shouldRender } = useHeaderPane({
    isOpen: isRendering,
    onStateChange: onPaneStateChange,
  });

  const { originalTime, snoozedTime } = useMemo(() => {
    if (!currentNotification) return { originalTime: undefined, snoozedTime: undefined };

    // Get the original notification time
    let dateStr: string | undefined;
    if (currentNotification.type === NotificationType.REMINDER) {
      dateStr = currentNotification.metadata?.original_remind_at || currentNotification.metadata?.remind_at;
    }
    if (!dateStr) {
      dateStr = currentNotification.created_at;
    }

    let origTime: number | undefined;
    if (dateStr) {
      const timestamp = new Date(dateStr).getTime();
      if (!Number.isNaN(timestamp) && timestamp > 946684800000) {
        origTime = Math.floor(timestamp / 1000);
      }
    }

    // Check if this notification was snoozed
    let snzTime: number | undefined;
    const snoozedUntil = currentNotification.snoozed_until;
    if (snoozedUntil) {
      const snoozedTimestamp = new Date(snoozedUntil).getTime();
      if (!Number.isNaN(snoozedTimestamp) && snoozedTimestamp > 946684800000) {
        snzTime = Math.floor(snoozedTimestamp / 1000);
      }
    }

    return { originalTime: origTime, snoozedTime: snzTime };
  }, [currentNotification]);

  const handleNotificationClick = useLastCallback(() => {
    if (!chat?.id || !messageId) return;
    focusMessage({
      chatId: chat.id,
      messageId,
      tabId: getCurrentTabId(),
    });
  });

  const handleDismiss = useLastCallback(() => {
    if (!currentNotification) return;
    dismissTelebizNotification({ notificationId: currentNotification.id });

    if (currentNotificationIndex > 0) {
      setCurrentNotificationIndex(currentNotificationIndex - 1);
    }
  });

  const handleSnooze = useLastCallback((minutes: number) => {
    if (!currentNotification) return;
    snoozeTelebizNotification({
      notificationId: currentNotification.id,
      snoozeMinutes: minutes,
    });

    if (currentNotificationIndex > 0) {
      setCurrentNotificationIndex(currentNotificationIndex - 1);
    }
  });

  const handleQuickReply = useLastCallback((replyText: string) => {
    openChatWithDraft({
      chatId,
      text: { text: replyText },
      tabId: getCurrentTabId(),
    });
  });

  const handleNextNotification = useLastCallback(() => {
    if (currentNotificationIndex < notifications.length - 1) {
      setCurrentNotificationIndex(currentNotificationIndex + 1);
    } else {
      setCurrentNotificationIndex(0);
    }
  });

  if (!shouldRender || !currentNotification) return undefined;

  const ReplyTrigger = useMemo(() => {
    return ({ onTrigger }: { onTrigger: () => void }) => (
      <Button
        isText
        fluid
        size="tiny"
        color="primary"
        onClick={onTrigger}
        className={styles.actionButton}
      >
        Reply
      </Button>
    );
  }, []);

  const SnoozeTrigger = useMemo(() => {
    return ({ onTrigger }: { onTrigger: () => void }) => (
      <Button
        isText
        fluid
        size="tiny"
        color="translucent"
        onClick={onTrigger}
        className={styles.actionButton}
      >
        Snooze
      </Button>
    );
  }, []);

  return (
    <div
      ref={ref}
      className={buildClassName(styles.root, 'TelebizNotificationPane')}
    >
      <div className={styles.notification}>
        <div className={styles.notificationContent}>
          <div
            className={buildClassName(styles.notificationContentInner, Boolean(messageId) && styles.clickable)}
            onClick={messageId ? handleNotificationClick : undefined}
            role={messageId ? 'button' : undefined}
            tabIndex={messageId ? 0 : undefined}
          >
            <div className={styles.notificationIndicator}>
              <TimeIcon className={styles.icon} />
            </div>
            <div className={styles.notificationContentText}>
              <div className={styles.notificationHeader}>
                <span className={styles.notificationHeaderTitle}>
                  {messageId ? currentNotification.message : currentNotification.title}
                </span>
                {Boolean(originalTime) && (
                  <>
                    <span className={styles.dot}>·</span>
                    <span className={styles.timeLabel}>
                      {formatPastDatetime(lang, originalTime)}
                    </span>
                  </>
                )}
                {Boolean(snoozedTime) && (
                  <span className={buildClassName(styles.timeLabel, styles.snoozedTimeLabel)}>
                    (Snoozed
                    {' '}
                    {formatPastDatetime(lang, snoozedTime)}
                    )
                  </span>
                )}
              </div>
              <div className={styles.notificationMessage}>
                {
                  message ? (
                    <MessageSummary
                      message={message}
                      inChatList
                    />
                  ) : currentNotification.message
                }
              </div>
            </div>
          </div>

          <div className={styles.notificationActions}>
            <DropdownMenu
              trigger={ReplyTrigger}
              positionX="left"
              positionY="top"
            >
              {QUICK_REPLIES.map((reply) => (
                <MenuItem
                  key={reply}
                  onClick={() => handleQuickReply(reply)}
                >
                  {reply}
                </MenuItem>
              ))}
            </DropdownMenu>

            <DropdownMenu
              trigger={SnoozeTrigger}
              positionX="left"
              positionY="top"
              className={styles.snoozeDropdown}
            >
              {SNOOZE_OPTIONS.map((option) => (
                <MenuItem
                  key={option.minutes}
                  onClick={() => handleSnooze(option.minutes)}
                >
                  {option.label}
                </MenuItem>
              ))}
            </DropdownMenu>

            <Button
              isText
              fluid
              size="tiny"
              color="danger"
              onClick={handleDismiss}
              className={styles.actionButton}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>

      {notifications.length > 1 && (
        <Button
          isText
          fluid
          size="tiny"
          color="primary"
          className={styles.nextUp}
          onClick={handleNextNotification}
        >
          <span className={styles.nextUpLabel}>Next up:</span>
          <span className={styles.nextUpTitle}>
            {notifications[(currentNotificationIndex + 1) % notifications.length].message}
          </span>
          <Icon name="next" className={styles.nextUpIcon} />
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const notifications = selectTelebizPendingNotificationsByChatId(global, chatId);
    const chat = selectChat(global, chatId);

    return {
      notifications,
      chat,
    };
  },
)(TelebizNotificationPane));
