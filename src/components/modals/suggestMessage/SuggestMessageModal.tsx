import {
  memo, useEffect, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiDraft, ApiPeer, ApiStarsAmount, ApiTypeCurrencyAmount } from '../../../api/types';
import type { TabState } from '../../../global/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import {
  STARS_CURRENCY_CODE,
  TON_CURRENCY_CODE,
} from '../../../config';
import { buildStarsAmount } from '../../../global/helpers/payments';
import { selectIsMonoforumAdmin, selectPeer } from '../../../global/selectors';
import { selectDraft } from '../../../global/selectors/threads';
import buildClassName from '../../../util/buildClassName';
import { formatShortDuration } from '../../../util/dates/duration';
import { formatTonFromNanos, parseTonPrefixToNanos } from '../../../util/formatCurrency';
import { formatCalendarDate, secondsToDate } from '../../../util/localization/dateFormat';
import {
  formatStarsAsIcon,
  formatStarsAsText,
  formatTonAsIcon,
  formatTonAsText } from '../../../util/localization/format';
import { getServerTime } from '../../../util/serverTime';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CalendarModal from '../../common/CalendarModal';
import GramIcon from '../../common/icons/GramIcon';
import Icon from '../../common/icons/Icon';
import Button from '../../ui/Button';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';

import styles from './SuggestMessageModal.module.scss';

export type OwnProps = {
  modal: TabState['suggestMessageModal'];
};

type StateProps = {
  starBalance?: ApiStarsAmount;
  tonBalance?: bigint;
  peer?: ApiPeer;
  currentDraft?: ApiDraft;
  maxStarsAmount: number;
  minStarsAmount: number;
  tonMaxAmount: bigint;
  tonMinAmount: bigint;
  ageMinSeconds: number;
  futureMin: number;
  futureMax: number;
  isMonoforumAdmin?: boolean;
};

// Add 1 minute if time is less than server min, to allow user to send the message
const FUTURE_TIME_ADJUSTMENT = 1 * 60;

const SuggestMessageModal = ({
  modal,
  starBalance,
  tonBalance,
  peer,
  currentDraft,
  maxStarsAmount,
  minStarsAmount,
  tonMaxAmount,
  tonMinAmount,
  ageMinSeconds,
  futureMin,
  futureMax,
  isMonoforumAdmin,
}: OwnProps & StateProps) => {
  const { closeSuggestMessageModal, updateDraftSuggestedPostInfo, openStarsBalanceModal } = getActions();
  const [isCalendarOpened, openCalendar, closeCalendar] = useFlag();

  const currentSuggestedPostInfo = currentDraft?.suggestedPostInfo;
  const currentReplyInfo = currentDraft?.replyInfo;
  const isInSuggestChangesMode = Boolean(currentReplyInfo);

  // Kept as typed, so that a price in Grams turns into nanotons without a float in between
  const [amountText, setAmountText] = useState(() => formatPriceText(currentSuggestedPostInfo?.price));
  const [selectedCurrency, setSelectedCurrency] = useState<ApiTypeCurrencyAmount['currency']>(
    currentSuggestedPostInfo?.price?.currency || STARS_CURRENCY_CODE,
  );
  const [scheduleDate, setScheduleDate] = useState<number | undefined>(
    currentSuggestedPostInfo?.scheduleDate
      ? currentSuggestedPostInfo.scheduleDate * 1000
      : undefined,
  );

  useEffect(() => {
    setAmountText(formatPriceText(currentSuggestedPostInfo?.price));
    setSelectedCurrency(currentSuggestedPostInfo?.price?.currency || STARS_CURRENCY_CODE);
    setScheduleDate(currentSuggestedPostInfo?.scheduleDate
      ? currentSuggestedPostInfo.scheduleDate * 1000
      : undefined);
  }, [currentSuggestedPostInfo]);

  const lang = useLang();

  const isCurrencyStars = selectedCurrency === STARS_CURRENCY_CODE;
  const starsAmount = Number(amountText) || 0;
  const tonAmount = parseTonPrefixToNanos(amountText);
  const hasAmount = isCurrencyStars ? starsAmount > 0 : tonAmount > 0n;
  const now = getServerTime();
  const minAt = (now + futureMin) * 1000;
  const maxAt = (now + futureMax) * 1000;
  const defaultSelectedTime = (now + futureMin * 2) * 1000;

  const handleAmountChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (!isCurrencyStars) {
      setAmountText(parseTonPrefixToNanos(value) > tonMaxAmount ? formatTonFromNanos(tonMaxAmount) : value);
      return;
    }

    const number = parseFloat(value);
    const result = value === '' || Number.isNaN(number) ? undefined
      : Math.min(Math.max(number, 0), maxStarsAmount);

    setAmountText(result?.toString() ?? '');
  });

  const handleExpireDateChange = useLastCallback((date: Date) => {
    setScheduleDate(date.getTime());
    closeCalendar();
  });

  const handleAnytimeClick = useLastCallback(() => {
    setScheduleDate(undefined);
    closeCalendar();
  });

  const isBelowMin = hasAmount && (isCurrencyStars ? starsAmount < minStarsAmount : tonAmount < tonMinAmount);

  const handleOffer = useLastCallback(() => {
    if (isBelowMin) {
      return;
    }

    if (!isMonoforumAdmin) {
      if (isCurrencyStars) {
        const currentBalance = starBalance?.amount || 0;

        if (starsAmount > currentBalance) {
          openStarsBalanceModal({
            topup: {
              balanceNeeded: starsAmount,
            },
          });
          return;
        }
      } else {
        const currentTonBalance = tonBalance || 0n;
        if (tonAmount > currentTonBalance) {
          openStarsBalanceModal({
            currency: TON_CURRENCY_CODE,
          });
          return;
        }
      }
    }

    updateDraftSuggestedPostInfo({
      price: isCurrencyStars ? buildStarsAmount(starsAmount) : { currency: TON_CURRENCY_CODE, amount: tonAmount },
      scheduleDate: scheduleDate
        ? Math.max(scheduleDate / 1000, getServerTime() + futureMin + FUTURE_TIME_ADJUSTMENT)
        : undefined,
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
          <div className={styles.currencySelector}>
            <Button
              className={styles.currencyButton}
              color={isCurrencyStars ? 'primary' : 'translucent'}
              pill
              fluid
              size="tiny"
              noFastClick
              onClick={() => setSelectedCurrency(STARS_CURRENCY_CODE)}
            >
              <Icon name="star" className={styles.currencyIcon} />
              {lang('CurrencyStars')}
            </Button>
            <Button
              className={styles.currencyButton}
              fluid
              color={!isCurrencyStars ? 'primary' : 'translucent'}
              pill
              size="tiny"
              noFastClick
              onClick={() => setSelectedCurrency(TON_CURRENCY_CODE)}
            >
              <GramIcon className={styles.currencyIcon} />
              {lang('CurrencyGram')}
            </Button>
          </div>
          <InputText
            label={lang('InputPlaceholderPrice')}
            className={buildClassName(styles.input)}
            value={amountText}
            onChange={handleAmountChange}
            inputMode="numeric"
            tabIndex={0}
            teactExperimentControlled={isCurrencyStars}
          />
          <div className={styles.description}>
            {isBelowMin
              ? lang('DescriptionSuggestedPostMinimumOffer', {
                amount: isCurrencyStars
                  ? formatStarsAsText(lang, minStarsAmount)
                  : formatTonAsText(lang, tonMinAmount) },
              { withNodes: true, withMarkdown: true })
              : isCurrencyStars
                ? lang('SuggestMessagePriceDescriptionStars')
                : lang('SuggestMessagePriceDescriptionGram')}
          </div>
        </div>

        <div className={styles.section}>
          <div className={buildClassName(styles.input, 'input-group', 'touched')}>
            <input
              type="text"
              className={buildClassName('form-control', isCalendarOpened && 'focus')}
              value={scheduleDate
                ? formatCalendarDate(lang, secondsToDate(scheduleDate / 1000), { isShort: true, withTime: true })
                : lang('SuggestMessageAnytime')}
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
          secondButtonLabel={lang('SuggestMessageAnytime')}
          onSecondButtonClick={handleAnytimeClick}
          description={lang('SuggestMessageDateTimeHint')}
        />

        <Button
          className={styles.offerButton}
          onClick={handleOffer}
          disabled={isBelowMin}
          inline
        >
          {isInSuggestChangesMode ? lang('ButtonUpdateTerms')
            : hasAmount ? lang('ButtonOfferAmount', {
              amount: isCurrencyStars
                ? formatStarsAsIcon(lang, starsAmount, { asFont: true })
                : formatTonAsIcon(lang, tonAmount),
            }, {
              withNodes: true,
              withMarkdown: true,
            }) : lang('ButtonOfferFree')}
        </Button>
      </div>
    </Modal>
  );
};

function formatPriceText(price?: ApiTypeCurrencyAmount) {
  if (!price?.amount) return '';

  return price.currency === TON_CURRENCY_CODE ? formatTonFromNanos(price.amount) : String(price.amount);
}

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const starBalance = global.stars?.balance;
    const peer = modal ? selectPeer(global, modal.chatId) : undefined;
    const currentDraft = modal ? selectDraft(global, modal.chatId, MAIN_THREAD_ID) : undefined;

    const { appConfig } = global;
    const maxStarsAmount = appConfig.starsSuggestedPostAmountMax;
    const minStarsAmount = appConfig.starsSuggestedPostAmountMin;
    const ageMinSeconds = appConfig.starsSuggestedPostAgeMin;
    const futureMin = appConfig.starsSuggestedPostFutureMin;
    const futureMax = appConfig.starsSuggestedPostFutureMax;

    const tonMaxAmount = appConfig.tonSuggestedPostAmountMax;
    const tonMinAmount = appConfig.tonSuggestedPostAmountMin;

    const isMonoforumAdmin = modal ? selectIsMonoforumAdmin(global, modal.chatId) : false;

    return {
      peer,
      starBalance,
      tonBalance: global.ton?.balance?.amount,
      currentDraft,
      maxStarsAmount,
      minStarsAmount,
      tonMaxAmount,
      tonMinAmount,
      ageMinSeconds,
      futureMin,
      futureMax,
      isMonoforumAdmin,
    };
  },
)(SuggestMessageModal));
