import type React from '../../../lib/teact/teact';
import {
  memo, useEffect,
  useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiDraft, ApiStarsAmount } from '../../../api/types';
import type { ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import {
  STARS_SUGGESTED_POST_AGE_MIN,
  STARS_SUGGESTED_POST_AMOUNT_MAX,
  STARS_SUGGESTED_POST_AMOUNT_MIN,
  STARS_SUGGESTED_POST_FUTURE_MAX,
  STARS_SUGGESTED_POST_FUTURE_MIN } from '../../../config';
import { selectPeer } from '../../../global/selectors';
import { selectDraft } from '../../../global/selectors/messages';
import buildClassName from '../../../util/buildClassName';
import { formatScheduledDateTime, formatShortDuration } from '../../../util/dates/dateFormat';
import { formatStarsAsIcon, formatStarsAsText } from '../../../util/localization/format';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import CalendarModal from '../../common/CalendarModal';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';

import styles from './SuggestMessageModal.module.scss';

export type OwnProps = {
  modal: TabState['suggestMessageModal'];
};

import useFlag from '../../../hooks/useFlag';

type StateProps = {
  starBalance?: ApiStarsAmount;
  peer?: ApiPeer;
  currentDraft?: ApiDraft;
  maxAmount: number;
  minAmount: number;
  ageMinSeconds: number;
  futureMin: number;
  futureMax: number;
};

const SuggestMessageModal = ({
  modal,
  starBalance,
  peer,
  currentDraft,
  maxAmount,
  minAmount,
  ageMinSeconds,
  futureMin,
  futureMax,
}: OwnProps & StateProps) => {
  const { closeSuggestMessageModal, updateDraftSuggestedPostInfo, openStarsBalanceModal } = getActions();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();

  const currentSuggestedPostInfo = currentDraft?.suggestedPostInfo;
  const currentReplyInfo = currentDraft?.replyInfo;
  const isInSuggestChangesMode = Boolean(currentReplyInfo);

  const [starsAmount, setStarsAmount] = useState<number | undefined>(
    currentSuggestedPostInfo?.price?.amount || undefined,
  );
  const [scheduleDate, setScheduleDate] = useState<number | undefined>(
    currentSuggestedPostInfo?.scheduleDate
      ? currentSuggestedPostInfo.scheduleDate * 1000
      : undefined,
  );

  useEffect(() => {
    setStarsAmount(currentSuggestedPostInfo?.price?.amount || undefined);
    setScheduleDate(currentSuggestedPostInfo?.scheduleDate
      ? currentSuggestedPostInfo.scheduleDate * 1000
      : undefined);
  }, [currentSuggestedPostInfo]);

  const lang = useLang();
  const oldLang = useOldLang();

  const now = Math.floor(Date.now() / 1000);
  const minAt = (now + futureMin) * 1000;
  const maxAt = (now + futureMax) * 1000;
  const defaultSelectedTime = (now + futureMin * 2) * 1000;

  const handleAmountChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const number = parseFloat(value);

    const result = value === '' || Number.isNaN(number) ? undefined
      : Math.min(Math.max(number, 0), maxAmount);

    setStarsAmount(result);
  });

  const handleExpireDateChange = useLastCallback((date: Date) => {
    setScheduleDate(date.getTime());
    closeCalendar();
  });

  const handleAnytimeClick = useLastCallback(() => {
    setScheduleDate(undefined);
    closeCalendar();
  });

  const isDisabled = Boolean(starsAmount) && starsAmount < minAmount;

  const handleOffer = useLastCallback(() => {
    const neededAmount = starsAmount || 0;

    if (isDisabled) {
      return;
    }

    const currentBalance = starBalance?.amount || 0;

    if (neededAmount > currentBalance) {
      openStarsBalanceModal({
        topup: {
          balanceNeeded: neededAmount,
        },
      });
      return;
    }

    updateDraftSuggestedPostInfo({
      price: { amount: neededAmount, nanos: 0 },
      scheduleDate: scheduleDate ? scheduleDate / 1000 : undefined,
    });

    closeSuggestMessageModal();
  });

  return (
    <Modal
      headerClassName={styles.modalHeader}
      isOpen={Boolean(modal)}
      onClose={closeSuggestMessageModal}
      isSlim
      isLowStackPriority
      hasCloseButton
      contentClassName={styles.content}
      title={isInSuggestChangesMode ? lang('TitleSuggestedChanges') : lang('TitleSuggestMessage')}
    >
      <div className={styles.form}>
        <div className={styles.section}>
          <InputText
            label={lang('InputPlaceholderPrice')}
            className={buildClassName(styles.input)}
            value={starsAmount?.toString()}
            onChange={handleAmountChange}
            inputMode="numeric"
            tabIndex={0}
            teactExperimentControlled
          />
          <div className={styles.description}>
            {starsAmount !== undefined && starsAmount > 0 && starsAmount < minAmount
              ? lang('DescriptionSuggestedPostMinimumOffer', {
                amount: formatStarsAsText(lang, minAmount) },
              { withNodes: true, withMarkdown: true })
              : lang('SuggestMessagePriceDescription', {
                currency: lang('CurrencyStars'),
              })}
          </div>
        </div>

        <div className={styles.section}>
          <div className={buildClassName('input-group', 'touched')}>
            <input
              type="text"
              className={buildClassName('form-control', isCalendarOpened && 'focus')}
              value={scheduleDate ? formatScheduledDateTime(scheduleDate / 1000, lang, oldLang) : lang('TitleAnytime')}
              autoComplete="off"
              onClick={openCalendar}
              onFocus={openCalendar}
              readOnly
            />
            <label>{lang('InputTitleSuggestMessageTime')}</label>
            <Icon name="down" className={styles.timeInputIcon} />
          </div>
          <div className={styles.description}>
            {lang('SuggestMessageTimeDescription', {
              hint: lang('SuggestMessageDateTimeHint'),
              duration: formatShortDuration(lang, ageMinSeconds, true),
            })}
          </div>
        </div>

        <CalendarModal
          isOpen={isCalendarOpened}
          isFutureMode
          withTimePicker
          minAt={minAt}
          maxAt={maxAt}
          onClose={closeCalendar}
          onSubmit={handleExpireDateChange}
          selectedAt={scheduleDate || defaultSelectedTime}
          submitButtonLabel={lang('Save')}
          secondButtonLabel={lang('TitleAnytime')}
          onSecondButtonClick={handleAnytimeClick}
          description={lang('SuggestMessageDateTimeHint')}
        />

        <Button
          className={styles.offerButton}
          onClick={handleOffer}
          size="smaller"
          disabled={isDisabled}
        >
          {isInSuggestChangesMode ? lang('ButtonUpdateTerms')
            : starsAmount ? lang('ButtonOfferAmount', {
              amount: formatStarsAsIcon(lang, starsAmount, { asFont: true }),
            }, {
              withNodes: true,
              withMarkdown: true,
            }) : lang('ButtonOfferFree')}
        </Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): StateProps => {
    const starBalance = global.stars?.balance;
    const peer = modal ? selectPeer(global, modal.chatId) : undefined;
    const currentDraft = modal ? selectDraft(global, modal.chatId, MAIN_THREAD_ID) : undefined;

    const { appConfig } = global;
    const maxAmount = appConfig?.starsSuggestedPostAmountMax || STARS_SUGGESTED_POST_AMOUNT_MAX;
    const minAmount = appConfig?.starsSuggestedPostAmountMin || STARS_SUGGESTED_POST_AMOUNT_MIN;
    const ageMinSeconds = appConfig?.starsSuggestedPostAgeMin || STARS_SUGGESTED_POST_AGE_MIN;
    const futureMin = appConfig?.starsSuggestedPostFutureMin || STARS_SUGGESTED_POST_FUTURE_MIN;
    const futureMax = appConfig?.starsSuggestedPostFutureMax || STARS_SUGGESTED_POST_FUTURE_MAX;

    return {
      peer,
      starBalance,
      currentDraft,
      maxAmount,
      minAmount,
      ageMinSeconds,
      futureMin,
      futureMax,
    };
  },
)(SuggestMessageModal));
