import { memo, useCallback, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiChat, ApiMessage } from '../../../../api/types';
import { type Notification, NotificationStatus, NotificationType } from '../../../services/types';

import {
  getMessageIsSpoiler,
  getMessageRoundVideo,
  getMessageSticker,
  getMessageVideo,
} from '../../../../global/helpers';
import { selectChat, selectChatMessage } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatPastDatetime } from '../../../../util/dates/dateFormat';
import { getCurrentTabId } from '../../../../util/establishMultitabRole';

import useMessageMediaHash from '../../../../hooks/media/useMessageMediaHash';
import useThumbnail from '../../../../hooks/media/useThumbnail';
import useContextMenuHandlers from '../../../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../../../hooks/useEnsureMessage';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMedia from '../../../../hooks/useMedia';

import Icon from '../../../../components/common/icons/Icon';
import MessageSummary from '../../../../components/common/MessageSummary';
import ListItem from '../../../../components/ui/ListItem';
import TelebizNotificationAvatar from './TelebizNotificationAvatar';
import TelebizNotificationContextMenu from './TelebizNotificationContextMenu';

import styles from './TelebizNotifications.module.scss';

interface OwnProps {
  notification: Notification;
  className?: string;
  onClick?: (notificationId: string) => void;
  isSelected: boolean;
}

interface StateProps {
  message?: ApiMessage;
  chat?: ApiChat;
}

const TelebizNotificationMessage = ({
  notification, className, isSelected, onClick, message, chat,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const {
    handleContextMenu,
    isContextMenuOpen,
    contextMenuAnchor,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const {
    focusMessage,
    markTelebizNotificationRead,
  } = getActions();

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() =>
    ref.current?.closest('.TelebizNotifications-module__notification'));

  const lang = useLang();

  const messageId = notification.metadata?.message_id ? Number(notification.metadata.message_id) : undefined;
  const chatId = notification.metadata?.chat_id;

  useEnsureMessage(chatId, messageId, message);

  const mediaHasPreview = message && !getMessageSticker(message);
  const thumbDataUri = useThumbnail(message);
  const mediaThumbnail = mediaHasPreview ? thumbDataUri : undefined;
  const mediaHash = useMessageMediaHash(message, 'micro');
  const mediaBlobUrl = useMedia(mediaHasPreview ? mediaHash : undefined);
  const isRoundVideo = Boolean(message && getMessageRoundVideo(message));

  const renderSummary = useCallback((
    msg: ApiMessage, blobUrl?: string, roundVideo?: boolean,
  ) => {
    const messageSummary = (
      <MessageSummary
        message={msg}
        noEmoji={Boolean(blobUrl)}
        inChatList
      />
    );

    if (!blobUrl) {
      return messageSummary;
    }

    const isSpoiler = getMessageIsSpoiler(msg);

    return (
      <span className={styles.mediaPreview}>
        <img
          src={blobUrl}
          alt=""
          className={buildClassName(
            styles.mediaPreviewImage,
            roundVideo && styles.round,
            isSpoiler && styles.mediaPreviewSpoiler,
          )}
          draggable={false}
        />
        {getMessageVideo(msg) && <Icon name="play" className={styles.playIcon} />}
        {messageSummary}
      </span>
    );
  }, []);

  const notificationTime = useMemo(() => {
    let dateStr: string | undefined;
    if (notification.type === NotificationType.REMINDER) {
      dateStr = notification.metadata?.original_remind_at;
    }
    if (!dateStr) {
      dateStr = notification.created_at;
    }
    if (!dateStr) return undefined;

    const timestamp = new Date(dateStr).getTime();
    if (Number.isNaN(timestamp) || timestamp < 946684800000) return undefined;

    return Math.floor(timestamp / 1000);
  }, [notification]);

  const handleClick = useCallback(() => {
    if (notification.status === NotificationStatus.UNREAD) {
      markTelebizNotificationRead({ notificationId: notification.id });
    }

    onClick?.(notification.id.toString());

    if (chat?.id && message?.id) {
      focusMessage({
        chatId: chat?.id,
        messageId: message.id,
        tabId: getCurrentTabId(),
      });
    }
  }, [notification, markTelebizNotificationRead, onClick, focusMessage, chat?.id, message?.id]);

  return (
    <ListItem
      key={notification.id}
      className={buildClassName(styles.notification, className, isSelected && styles.selected)}
      buttonClassName={styles.notificationButton}
      ref={ref}
      onContextMenu={handleContextMenu}
      leftElement={<TelebizNotificationAvatar notification={notification} />}
      rightElement={
        notification.status === NotificationStatus.UNREAD
          ? (
            <div className={styles.unreadContainer}>
              <div className={styles.unreadIndicator}></div>
            </div>
          ) : undefined
      }
      onClick={handleClick}
    >
      <div className={styles.notificationContent}>
        <div className={styles.notificationTitle}>
          {notification.message}
        </div>
        <div className={styles.notificationMessage}>
          <span className={styles.messageSummary}>
            {message ? renderSummary(message, mediaBlobUrl || mediaThumbnail, isRoundVideo) : notification.message}
          </span>
        </div>
        <div className={styles.notificationTime}>
          {Boolean(notificationTime) && formatPastDatetime(lang, notificationTime)}
          {chat?.title && (
            <span className={styles.notificationChatTitle}>
              {' \u2022 '}
              {chat.title}
            </span>
          )}
        </div>
      </div>
      <TelebizNotificationContextMenu
        notification={notification}
        isOpen={isContextMenuOpen}
        anchor={contextMenuAnchor}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        getTriggerElement={getTriggerElement}
        getRootElement={getRootElement}
      />
    </ListItem>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { notification }): Complete<StateProps> => {
    const msg = notification.metadata?.message_id
      ? selectChatMessage(global, notification.metadata.chat_id, Number(notification.metadata.message_id))
      : undefined;
    const chatData = notification.metadata?.chat_id ? selectChat(global, notification.metadata.chat_id) : undefined;
    return {
      message: msg,
      chat: chatData,
    };
  },
)(TelebizNotificationMessage));
