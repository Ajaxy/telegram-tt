import { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Reminder } from '../../../services/types';

import {
  selectTelebizPendingReminders,
  selectTelebizRemindersIsLoading,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import NothingFound from '../../../../components/common/NothingFound';
import TelebizReminderItem from './TelebizReminderItem';

import styles from './TelebizPendingReminders.module.scss';

interface OwnProps {
  isActive: boolean;
}

type StateProps = {
  pendingReminders: Reminder[];
  isLoading: boolean;
};

const TelebizPendingReminders = ({
  isActive,
  pendingReminders,
  isLoading,
}: OwnProps & StateProps) => {
  const { loadTelebizReminders, openTelebizReminderModal } = getActions();
  const lang = useTelebizLang();

  useEffect(() => {
    if (isActive) {
      loadTelebizReminders({ status: 'pending' });
    }
  }, [isActive, loadTelebizReminders]);

  const handleEditReminder = useLastCallback((reminder: Reminder) => {
    openTelebizReminderModal({
      message: {
        chatId: reminder.chat_id,
        id: Number(reminder.message_id),
      },
      reminder,
    });
  });

  return (
    <div className={styles.container}>
      <div className={buildClassName(styles.list, 'custom-scroll')}>
        {!isLoading && pendingReminders.length === 0 && (
          <NothingFound
            text={lang('PendingReminders.Empty')}
            description={lang('PendingReminders.EmptyDescription')}
            withSticker
          />
        )}
        {pendingReminders.map((reminder) => (
          <TelebizReminderItem
            key={reminder.id}
            reminder={reminder}
            onEdit={handleEditReminder}
          />
        ))}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      pendingReminders: selectTelebizPendingReminders(global),
      isLoading: selectTelebizRemindersIsLoading(global),
    };
  },
)(TelebizPendingReminders));
