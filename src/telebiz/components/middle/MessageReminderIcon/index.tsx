import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { Reminder } from '../../../services/types';

import { formatTimeAndOptionalDate } from '../../../util/dates';

import Icon from '../../../../components/common/icons/Icon';

import styles from './MessageReminderIcon.module.scss';

interface OwnProps {
  reminder: Reminder;
}

const MessageReminderIcon: FC<OwnProps> = ({ reminder }) => {
  const { openTelebizReminderModal } = getActions();

  return (
    <span
      className={styles.messageReminder}
      onClick={(e) => {
        e.stopPropagation();
        openTelebizReminderModal({
          message: { chatId: reminder.chat_id, id: Number(reminder.message_id) },
          reminder,
        });
      }}
    >
      <Icon name="timer" />
      <span>{formatTimeAndOptionalDate(reminder.remind_at)}</span>
    </span>
  );
};

export default memo(MessageReminderIcon);
