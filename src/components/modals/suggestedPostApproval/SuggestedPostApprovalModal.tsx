import { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';

import {
  STARS_CURRENCY_CODE,
  TON_CURRENCY_CODE,
} from '../../../config';
import { getPeerFullTitle } from '../../../global/helpers/peers';
import { selectChatMessage, selectIsMonoforumAdmin, selectSender } from '../../../global/selectors';
import { formatScheduledDateTime, formatShortDuration } from '../../../util/dates/dateFormat';
import { convertTonFromNanos } from '../../../util/formatCurrency';
import { formatStarsAsText, formatTonAsText } from '../../../util/localization/format';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import CalendarModal from '../../common/CalendarModal';
import ConfirmDialog from '../../ui/ConfirmDialog';

import styles from './SuggestedPostApprovalModal.module.scss';

export type OwnProps = {
  modal: TabState['suggestedPostApprovalModal'];
};

type StateProps = {
  commissionPermille: number;
  tonCommissionPermille: number;
  minAge: number;
  futureMin: number;
  futureMax: number;
  message?: ApiMessage;
  sender?: ApiPeer;
  isAdmin?: boolean;
  scheduleDate?: number;
};

const SuggestedPostApprovalModal = ({
  modal,
  message,
  sender,
  isAdmin,
  commissionPermille,
  tonCommissionPermille,
  minAge,
  futureMin,
  futureMax,
  scheduleDate,
}: OwnProps & StateProps) => {
  const {
    closeSuggestedPostApprovalModal,
    approveSuggestedPost,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();

  const now = Math.floor(Date.now() / 1000);
  const minAt = (now + futureMin) * 1000;
  const maxAt = (now + futureMax) * 1000;
  const defaultSelectedTime = now + futureMin * 2;

  const [selectedScheduleDate, setSelectedScheduleDate] = useState<number>(defaultSelectedTime);

  const handleClose = useLastCallback(() => {
    closeSuggestedPostApprovalModal();
  });

  const handleApprove = useLastCallback((date?: number) => {
    if (!modal) return;

    approveSuggestedPost({
      chatId: modal.chatId,
      messageId: modal.messageId,
      scheduleDate: date,
    });

    closeSuggestedPostApprovalModal();
  });

  const handleCalendarDateChange = useLastCallback((date: Date) => {
    const time = Math.floor(date.getTime() / 1000);
    setSelectedScheduleDate(time);
  });

  const handleCalendarSubmit = useLastCallback((date: Date) => {
    const time = Math.floor(date.getTime() / 1000);
    closeCalendar();
    handleApprove(time);
  });

  const handlePublishNow = useLastCallback(() => {
    closeCalendar();
    handleApprove();
  });

  const handleNext = useLastCallback(() => {
    if (scheduleDate) {
      handleApprove(scheduleDate);
    } else {
      openCalendar();
    }
  });

  if (!modal || !message) {
    return undefined;
  }

  const senderName = sender ? getPeerFullTitle(oldLang, sender) : '';

  const renderContent = () => {
    const price = message?.suggestedPostInfo?.price;
    const amount = price?.amount;
    const currency = price?.currency || STARS_CURRENCY_CODE;

    const question = lang(
      'SuggestedPostConfirmMessage',
      { peer: senderName },
      { withNodes: true, withMarkdown: true });

    const questionText = renderText(question);
    if (!amount) {
      return questionText;
    }

    const currentCommissionPermille = currency === TON_CURRENCY_CODE ? tonCommissionPermille : commissionPermille;
    const commission = (currentCommissionPermille / 10);
    const amountWithCommission = amount / 100 * commission;

    const formattedAmount = currency === TON_CURRENCY_CODE
      ? formatTonAsText(lang, convertTonFromNanos(amountWithCommission))
      : formatStarsAsText(lang, amountWithCommission);

    const ageMinSeconds = minAge;
    const duration = formatShortDuration(lang, ageMinSeconds, true);

    if (scheduleDate) {
      const time = formatScheduledDateTime(scheduleDate, lang, oldLang);

      const key
        = isAdmin ? 'SuggestedPostConfirmDetailsWithTimeAdmin' : 'SuggestedPostConfirmDetailsWithTimeUser';

      return (
        <>
          <div>
            {questionText}
          </div>
          <div className={styles.details}>
            {renderText(lang(key, {
              amount: formattedAmount,
              commission,
              duration,
              time,
            }, { withNodes: true, withMarkdown: true }))}
          </div>
        </>
      );
    }

    const key = isAdmin ? 'SuggestedPostConfirmDetailsAdmin' : 'SuggestedPostConfirmDetailsUser';

    return (
      <>
        <div>
          {questionText}
        </div>
        <div className={styles.details}>
          {renderText(lang(key, {
            amount: formattedAmount,
            commission,
            duration,
          }, { withNodes: true, withMarkdown: true }))}
        </div>
      </>
    );
  };

  return (
    <>
      <ConfirmDialog
        isOpen={Boolean(modal) && !isCalendarOpened}
        onClose={handleClose}
        title={lang('SuggestedPostConfirmTitle')}
        confirmHandler={handleNext}
        confirmLabel={scheduleDate ? lang('ButtonPublish') : lang('Next')}
      >
        {renderContent()}
      </ConfirmDialog>

      <CalendarModal
        isOpen={isCalendarOpened}
        isFutureMode
        withTimePicker
        minAt={minAt}
        maxAt={maxAt}
        onClose={closeCalendar}
        onSubmit={handleCalendarSubmit}
        onDateChange={handleCalendarDateChange}
        selectedAt={selectedScheduleDate * 1000}
        submitButtonLabel={lang('ButtonPublishAtTime', {
          time: formatScheduledDateTime(selectedScheduleDate, lang, oldLang),
        })}
        secondButtonLabel={lang('PublishNow')}
        onSecondButtonClick={handlePublishNow}
        description={lang('SuggestMessageDateTimeHint')}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const message = modal && selectChatMessage(global, modal.chatId, modal.messageId);
    const sender = message ? selectSender(global, message) : undefined;
    const isAdmin = modal && selectIsMonoforumAdmin(global, modal.chatId);
    const { appConfig } = global;
    const commissionPermille = appConfig.starsSuggestedPostCommissionPermille;
    const tonCommissionPermille = appConfig.tonSuggestedPostCommissionPermille;
    const minAge = appConfig.starsSuggestedPostAgeMin;
    const futureMin = appConfig.starsSuggestedPostFutureMin;
    const futureMax = appConfig.starsSuggestedPostFutureMax;
    const scheduleDate = message?.suggestedPostInfo?.scheduleDate;

    return {
      minAge,
      futureMin,
      futureMax,
      message,
      sender,
      isAdmin,
      commissionPermille,
      tonCommissionPermille,
      scheduleDate,
    };
  },
)(SuggestedPostApprovalModal));
