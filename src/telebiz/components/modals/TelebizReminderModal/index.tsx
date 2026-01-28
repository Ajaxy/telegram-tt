import { memo, useCallback, useEffect, useMemo, useState } from '@teact';
import { withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { CreateReminderData, Reminder, UpdateReminderData } from '../../../services';

import { getMessageLink } from '../../../../global/helpers';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { addTime, formatDateTime, toLocalISOString } from '../../../util/dates';

import { useTelebizLang } from '../../../hooks/useTelebizLang';

import CalendarModal from '../../../../components/common/CalendarModal';
import Icon from '../../../../components/common/icons/Icon';
import Button from '../../../../components/ui/Button';
import InputText from '../../../../components/ui/InputText';
import Modal from '../../../../components/ui/Modal';
import TextArea from '../../../../components/ui/TextArea';

import inputStyles from '../../common/ProviderEntityForm/ProviderEntityForm.module.scss';
import styles from './TelebizReminderModal.module.scss';

enum RemindInOption {
  THIRTY_MINUTES = '30_minutes',
  ONE_HOUR = '1_hour',
  TWO_HOURS = '2_hours',
  SIX_HOURS = '6_hours',
  ONE_DAY = '1_day',
  TWO_DAYS = '2_days',
  THREE_DAYS = '3_days',
  ONE_WEEK = '1_week',
  ONE_MONTH = '1_month',
}

const REMIND_IN_OPTIONS = [
  { value: RemindInOption.THIRTY_MINUTES, label: '30m' },
  { value: RemindInOption.ONE_HOUR, label: '1h' },
  { value: RemindInOption.TWO_HOURS, label: '2h' },
  { value: RemindInOption.SIX_HOURS, label: '6h' },
  { value: RemindInOption.ONE_DAY, label: '1d' },
  { value: RemindInOption.TWO_DAYS, label: '2d' },
  { value: RemindInOption.THREE_DAYS, label: '3d' },
  { value: RemindInOption.ONE_WEEK, label: '1w' },
  { value: RemindInOption.ONE_MONTH, label: '1m' },
];

interface OwnProps {
  isOpen: boolean;
  onClose: () => void;
  message: { chatId: string; id: number };
  reminder?: Reminder;
  createReminder: (data: CreateReminderData) => void;
  updateReminder: (id: number, data: UpdateReminderData) => void;
  deleteReminder: (id: number) => void;
  organizationId?: number;
}

interface StateProps {
  peer?: ApiPeer;
}

const TelebizReminderModal = ({
  isOpen,
  onClose,
  message,
  reminder,
  createReminder,
  updateReminder,
  deleteReminder,
  organizationId,
  peer,
}: OwnProps & StateProps) => {
  const lang = useTelebizLang();
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [reminderDate, setReminderDate] = useState<string | undefined>(undefined);

  const closeCalendar = () => {
    setIsCalendarOpen(false);
  };

  const openCalendar = () => {
    setIsCalendarOpen(true);
  };

  useEffect(() => {
    if (reminder) {
      setDescription(reminder.description || '');
      setReminderDate(reminder.remind_at || undefined);
    }
  }, [isOpen, reminder]);

  const handleRemindInChange = (value: RemindInOption) => {
    const now = (new Date()).toISOString();
    switch (value) {
      case RemindInOption.THIRTY_MINUTES:
        setReminderDate(addTime(now, 30, 'minutes'));
        break;
      case RemindInOption.ONE_HOUR:
        setReminderDate(addTime(now, 1, 'hours'));
        break;
      case RemindInOption.TWO_HOURS:
        setReminderDate(addTime(now, 2, 'hours'));
        break;
      case RemindInOption.SIX_HOURS:
        setReminderDate(addTime(now, 6, 'hours'));
        break;
      case RemindInOption.ONE_DAY:
        setReminderDate(addTime(now, 1, 'days'));
        break;
      case RemindInOption.TWO_DAYS:
        setReminderDate(addTime(now, 2, 'days'));
        break;
      case RemindInOption.THREE_DAYS:
        setReminderDate(addTime(now, 3, 'days'));
        break;
      case RemindInOption.ONE_WEEK:
        setReminderDate(addTime(now, 1, 'weeks'));
        break;
      case RemindInOption.ONE_MONTH:
        setReminderDate(addTime(now, 30, 'days'));
        break;
      default:
        setReminderDate(undefined);
        break;
    }
  };

  const clearModalData = () => {
    setDescription('');
    setReminderDate(undefined);
  };

  const handleSubmit = useCallback(() => {
    if (!reminderDate || new Date(reminderDate) <= new Date()) {
      return;
    }
    const messageLink = peer ? getMessageLink(peer, undefined, message.id) : undefined;

    if (reminder) {
      updateReminder(reminder.id, {
        description: description || undefined,
        remind_at: reminderDate,
      });
    } else {
      createReminder({
        chat_id: message.chatId,
        message_id: message.id.toString(),
        description: description || undefined,
        remind_at: reminderDate,
        organization_id: organizationId,
        metadata: {
          message_link: messageLink,
        },
      });
    }

    // Reset form and close
    clearModalData();
    onClose();
  }, [
    reminderDate,
    description,
    message,
    createReminder,
    organizationId,
    onClose,
    peer,
    reminder,
    updateReminder,
  ]);

  const handleDelete = useCallback(() => {
    if (reminder) {
      deleteReminder(reminder.id);
    }
    clearModalData();
    onClose();
  }, [reminder, deleteReminder, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const isValid = useMemo(() => {
    return reminderDate && new Date(reminderDate) > new Date();
  }, [reminderDate]);

  return (
    <Modal
      className={styles.modal}
      isOpen={isOpen}
      onClose={handleClose}
      contentClassName={styles.modalContent}
      title={reminder ? lang('TelebizReminderModal.EditTitle') : lang('TelebizReminderModal.ModalTitle')}
      hasCloseButton
      isSlim
    >
      <form>
        <TextArea
          label={lang('TelebizReminderModal.Description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lang('TelebizReminderModal.DescriptionPlaceholder')}
          noReplaceNewlines
        />
        <div className={buildClassName(styles.dateInput, inputStyles.calendarInput)} onClick={() => openCalendar()}>
          <InputText
            value={reminderDate ? formatDateTime(reminderDate) : ''}
            label={lang('TelebizReminderModal.Date')}
            readOnly
          />
          <Icon
            name="calendar"
            className={inputStyles.calendarIcon}
            onClick={() => openCalendar()}
          />
        </div>
        <div className={styles.remindInButtons}>
          {
            REMIND_IN_OPTIONS.map((option) => (
              <Button
                key={option.value}
                onClick={() => handleRemindInChange(option.value)}
                color="translucent"
                round
                size="tiny"
                className={styles.remindInButton}
              >
                {option.label}
              </Button>
            ))
          }
        </div>
        <CalendarModal
          isOpen={Boolean(isCalendarOpen)}
          isFutureMode
          withTimePicker
          onClose={closeCalendar}
          onSubmit={(date) => {
            setReminderDate(toLocalISOString(date));
            closeCalendar();
          }}
          selectedAt={reminderDate ? new Date(reminderDate).getTime() : new Date().getTime()}
          submitButtonLabel={lang('TelebizReminderModal.SelectDate')}
        />
        <div className={styles.buttons}>
          <Button
            onClick={handleSubmit}
            disabled={!isValid}
          >
            Confirm
            {reminderDate ? ` (${formatDateTime(reminderDate)})` : ''}
          </Button>
          {reminder && (
            <Button
              type="button"
              onClick={handleDelete}
              color="danger"
            >
              {lang('TelebizReminderModal.Delete')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const peer = selectPeer(global, message.chatId);
    return {
      peer,
    };
  },
)(TelebizReminderModal));
