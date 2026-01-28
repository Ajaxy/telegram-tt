import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { CreateReminderData, Reminder, UpdateReminderData } from '../../../services/types';

import { selectTabState } from '../../../../global/selectors';
import { selectCurrentTelebizOrganization } from '../../../global/selectors';
import TelebizReminderModal from '.';

import useLastCallback from '../../../../hooks/useLastCallback';

type StateProps = {
  isOpen: boolean;
  message?: { chatId: string; id: number };
  reminder?: Reminder;
  organizationId?: number;
};

const TelebizReminderModalContainer: FC<StateProps> = ({
  isOpen,
  message,
  reminder,
  organizationId,
}) => {
  const {
    closeTelebizReminderModal,
    createTelebizReminder,
    updateTelebizReminder,
    deleteTelebizReminder,
  } = getActions();

  const handleClose = useLastCallback(() => {
    closeTelebizReminderModal();
  });

  const handleCreate = useLastCallback((data: CreateReminderData) => {
    createTelebizReminder(data);
    closeTelebizReminderModal();
  });

  const handleUpdate = useLastCallback((id: number, data: UpdateReminderData) => {
    updateTelebizReminder({ reminderId: id, data });
    closeTelebizReminderModal();
  });

  const handleDelete = useLastCallback((id: number) => {
    deleteTelebizReminder({ reminderId: id });
    closeTelebizReminderModal();
  });

  if (!isOpen || !message) {
    return undefined;
  }

  return (
    <TelebizReminderModal
      isOpen={isOpen}
      onClose={handleClose}
      message={message}
      reminder={reminder}
      createReminder={handleCreate}
      updateReminder={handleUpdate}
      deleteReminder={handleDelete}
      organizationId={organizationId}
    />
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const organization = selectCurrentTelebizOrganization(global);

    return {
      isOpen: Boolean(tabState.reminderModal?.isOpen),
      message: tabState.reminderModal?.message,
      reminder: tabState.reminderModal?.reminder,
      organizationId: organization?.id,
    };
  },
)(TelebizReminderModalContainer));
