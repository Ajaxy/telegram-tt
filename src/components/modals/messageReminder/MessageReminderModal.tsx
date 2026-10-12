import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { IconName } from '../../../types/icons';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectChatMessage, selectSender } from '../../../global/selectors';
import { formatScheduledDateTime, formatTime, getDayStartAt } from '../../../util/dates/oldDateFormat';
import { getServerTime, getServerTimeOffset } from '../../../util/serverTime';
import { renderMessageSummary } from '../../common/helpers/renderMessageText';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import useSchedule from '../../../hooks/useSchedule';

import Avatar from '../../common/Avatar';
import Control, { ControlAfter, ControlIcon, ControlLabel } from '@gili/layout/Control';
import Interactive from '@gili/layout/Interactive';
import Modal, { ModalCloseButton, ModalHeader, ModalTitle } from '@gili/modal/Modal';

import styles from './MessageReminderModal.module.scss';

export type OwnProps = {
  modal: NonNullable<TabState['messageReminderModal']>;
  isOpen: boolean;
};

type StateProps = {
  message?: ApiMessage;
  sender?: ApiPeer;
};

type ReminderPreset = {
  key: 'InOneHour' | 'InThreeHours' | 'ThisEvening' | 'TomorrowMorning' | 'NextWeek';
  iconName: IconName;
  iconColor: string;
  timestamp: number;
};

const ICON_COLORS = {
  soon: '#0a84ff',
  later: '#2faeff',
  evening: '#6a5cff',
  morning: '#ffb300',
  week: '#34c759',
  custom: '#8e8e93',
};

const HOUR = 60 * 60;
const EVENING_HOUR = 18;
const MORNING_HOUR = 9;
const EVENING_CUTOFF_HOUR = 17;
const DAY = 24 * HOUR;
const WEEK_DAYS = 7;

const MessageReminderModal = ({
  modal,
  isOpen,
  message,
  sender,
}: OwnProps & StateProps) => {
  const { closeMessageReminderModal, setMessageReminder, showNotification } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const presets = useMemo(() => (isOpen ? buildPresets() : []), [isOpen]);

  const handleClose = useLastCallback(() => {
    closeMessageReminderModal();
  });

  const handleScheduled = useLastCallback((scheduledAt: number) => {
    setMessageReminder({ chatId: modal.chatId, messageId: modal.messageId, scheduledAt });
    showNotification({
      message: {
        key: 'ReminderSetForToast',
        variables: { time: formatScheduledDateTime(scheduledAt, lang, oldLang) },
        options: { withNodes: true, withMarkdown: true },
      },
    });
    closeMessageReminderModal();
  });

  const [requestCalendar, calendar] = useSchedule(undefined, undefined, getServerTime() + HOUR);

  const handlePickCustom = useLastCallback(() => {
    requestCalendar(handleScheduled);
  });

  const header = useMemo(() => (
    <ModalHeader>
      <ModalCloseButton />
      <ModalTitle>{lang('RemindMeTitle')}</ModalTitle>
    </ModalHeader>
  ), [lang]);

  const summary = useMemo(() => (
    message ? renderMessageSummary(lang, message) : undefined
  ), [lang, message]);

  return (
    <Modal
      isOpen={isOpen}
      header={header}
      width="slim"
      onClose={handleClose}
    >
      {message && (
        <div className={styles.preview}>
          {sender && <Avatar peer={sender} size="small" />}
          <div className={styles.previewText}>
            {sender && <div className={styles.previewTitle}>{getPeerTitle(lang, sender)}</div>}
            <div className={styles.previewSummary}>{summary}</div>
          </div>
        </div>
      )}
      <p className={styles.description}>{lang('RemindMeDescription')}</p>
      <div className={styles.options}>
        {presets.map(({
          key, iconName, iconColor, timestamp,
        }) => (
          <Interactive key={key} clickable ripple onClick={() => handleScheduled(timestamp)}>
            <Control>
              <ControlIcon iconName={iconName} backgroundColor={iconColor} />
              <ControlLabel>{lang(`RemindMe${key}`)}</ControlLabel>
              <ControlAfter className={styles.time}>
                {formatPresetTime(oldLang, timestamp)}
              </ControlAfter>
            </Control>
          </Interactive>
        ))}
        <Interactive clickable ripple onClick={handlePickCustom}>
          <Control>
            <ControlIcon iconName="calendar" backgroundColor={ICON_COLORS.custom} />
            <ControlLabel>{lang('RemindMeCustom')}</ControlLabel>
          </Control>
        </Interactive>
      </div>
      {calendar}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const message = selectChatMessage(global, modal.chatId, modal.messageId);

    return {
      message,
      sender: message ? selectSender(global, message) : undefined,
    };
  },
)(MessageReminderModal));

function buildPresets(): ReminderPreset[] {
  const now = getServerTime();
  const localNow = new Date((now - getServerTimeOffset()) * 1000);
  const presets: ReminderPreset[] = [
    {
      key: 'InOneHour', iconName: 'clock', iconColor: ICON_COLORS.soon, timestamp: now + HOUR,
    },
    {
      key: 'InThreeHours', iconName: 'clock-filled', iconColor: ICON_COLORS.later, timestamp: now + 3 * HOUR,
    },
  ];

  if (localNow.getHours() < EVENING_CUTOFF_HOUR) {
    presets.push({
      key: 'ThisEvening',
      iconName: 'schedule',
      iconColor: ICON_COLORS.evening,
      timestamp: getLocalTimestampAt(localNow, 0, EVENING_HOUR),
    });
  }

  presets.push({
    key: 'TomorrowMorning',
    iconName: 'schedule',
    iconColor: ICON_COLORS.morning,
    timestamp: getLocalTimestampAt(localNow, 1, MORNING_HOUR),
  });

  const daysUntilMonday = ((WEEK_DAYS + 1 - localNow.getDay()) % WEEK_DAYS) || WEEK_DAYS;
  presets.push({
    key: 'NextWeek',
    iconName: 'calendar',
    iconColor: ICON_COLORS.week,
    timestamp: getLocalTimestampAt(localNow, daysUntilMonday, MORNING_HOUR),
  });

  return presets;
}

function getLocalTimestampAt(localNow: Date, daysAhead: number, hour: number) {
  const dayStart = getDayStartAt(localNow) / 1000;
  return dayStart + daysAhead * DAY + hour * HOUR + getServerTimeOffset();
}

function formatPresetTime(oldLang: ReturnType<typeof useOldLang>, timestamp: number) {
  return formatTime(oldLang, (timestamp - getServerTimeOffset()) * 1000);
}
