import { memo, useMemo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { TabState } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { NEXT_ARROW_REPLACEMENT } from '../../../util/localization/format';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useSyncEffect from '../../../hooks/useSyncEffect';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import InputText from '../../ui/InputText';
import Link from '../../ui/Link';
import Marquee from '../../ui/Marquee';
import MenuItem from '../../ui/MenuItem';
import Modal from '../../ui/Modal';

import styles from './BirthdaySetupModal.module.scss';

export type OwnProps = {
  modal: TabState['birthdaySetupModal'];
};

type StateProps = {
  suggestForUser?: ApiUser;
};

const STICKER_SIZE = 120;

const MAX_AGE = 150;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR - MAX_AGE;

type MonthIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
const MONTH_INDEXES = Array.from({ length: 12 }, (_, index) => index + 1) as MonthIndex[];

const BirthdaySetupModal = ({ modal, suggestForUser }: OwnProps & StateProps) => {
  const {
    closeBirthdaySetupModal, openSettingsScreen, updateBirthday, suggestBirthday,
  } = getActions();

  const { currentBirthday, suggestForUserId, isFromSuggestion } = modal || {};

  const dialogRef = useRef<HTMLDivElement>();

  const [day, setDay] = useState<number | undefined>(currentBirthday?.day);
  const [month, setMonth] = useState<MonthIndex | undefined>(currentBirthday?.month as MonthIndex | undefined);
  const [year, setYear] = useState<number | undefined>(currentBirthday?.year);

  // The modal stays mounted between opens, so field state is reset on each new open
  useSyncEffect(([prevModal]) => {
    if (modal && modal !== prevModal) {
      const newBirthday = modal.currentBirthday;
      setDay(newBirthday?.day);
      setMonth(newBirthday?.month as MonthIndex | undefined);
      setYear(newBirthday?.year);
    }
  }, [modal]);

  const lang = useLang();

  const handleClose = useLastCallback(() => {
    closeBirthdaySetupModal();
  });

  const handleRemove = useLastCallback(() => {
    updateBirthday({
      birthday: undefined,
    });
    closeBirthdaySetupModal();
  });

  const handlePrivacyClick = useLastCallback(() => {
    openSettingsScreen({ screen: SettingsScreens.PrivacyBirthday });
    closeBirthdaySetupModal();
  });

  const maxDay = getMaxMonthDay(month, year);

  const handleDayChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      setDay(undefined);
      return;
    }

    const value = Number(e.target.value.replace(/[^\d]+/g, ''));
    if (!value) {
      e.preventDefault();
      return;
    }

    if (value > maxDay) {
      setDay(maxDay);
      return;
    }

    setDay(Math.max(value, 1));
  });

  const handleMonthUpdate = useLastCallback((value: MonthIndex) => {
    setMonth(value);
    if (day) setDay(Math.min(day, getMaxMonthDay(value, year)));
  });

  const handleYearChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) {
      setYear(undefined);
      return;
    }

    const value = Number(e.target.value.replace(/[^\d]+/g, ''));
    if (!value) {
      e.preventDefault();
      return;
    }

    if (value > CURRENT_YEAR) {
      setYear(CURRENT_YEAR);
      return;
    }

    setYear(value);

    if (day) setDay(Math.min(day, getMaxMonthDay(month, value)));
  });

  const handleYearBlur = useLastCallback(() => {
    if (!year) {
      setYear(undefined);
      return;
    }

    if (year < 100) {
      setYear(1900 + year);
      return;
    }

    if (year < MIN_YEAR) {
      setYear(MIN_YEAR);
      return;
    }
  });

  const handleHideYear = useLastCallback(() => {
    setYear(undefined);
  });

  const handleSubmit = useLastCallback(() => {
    if (!day || !month) return;
    const birthday = {
      day,
      month,
      year,
    };

    if (suggestForUserId) {
      suggestBirthday({ userId: suggestForUserId, birthday });
    } else {
      updateBirthday({ birthday });
    }
    closeBirthdaySetupModal();
  });

  const MonthTrigger = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <InputText
        label={lang('BirthdayInputMonth')}
        className={buildClassName(styles.input, styles.month, isOpen && 'active')}
        value={month ? lang(`Month${month}`) : ''}
        onClick={onTrigger}
        inputMode="numeric"
        teactExperimentControlled
      />
    );
  }, [lang, month]);

  return (
    <Modal
      isOpen={Boolean(modal)}
      hasCloseButton
      hasAbsoluteCloseButton
      isSlim
      dialogRef={dialogRef}
      contentClassName={styles.content}
      onClose={handleClose}
    >
      <div className={styles.header}>
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.DuckCake}
          size={STICKER_SIZE}
          className="section-icon"
        />
        <h3 className={styles.title}>
          <Marquee>
            {suggestForUser
              ? lang('BirthdayTitleForPeer', { user: getPeerTitle(lang, suggestForUser) })
              : lang('BirthdaySetupTitle')}
          </Marquee>
        </h3>
      </div>
      <div className={styles.inputs}>
        <InputText
          label={lang('BirthdayInputDay')}
          className={styles.input}
          value={day?.toString()}
          onChange={handleDayChange}
          maxLength={2}
          inputMode="numeric"
        />
        <DropdownMenu
          className={buildClassName(styles.monthDropdown, 'with-menu-transitions')}
          bubbleClassName={styles.monthBubble}
          autoClose
          positionY="bottom"
          trigger={MonthTrigger}
        >
          {MONTH_INDEXES.map((index: MonthIndex) => (
            <MenuItem key={index} onClick={() => handleMonthUpdate(index)}>
              {lang(`Month${index}`)}
            </MenuItem>
          ))}
        </DropdownMenu>
        <InputText
          label={lang('BirthdayInputYear')}
          className={styles.input}
          value={year?.toString()}
          onBlur={handleYearBlur}
          onChange={handleYearChange}
          maxLength={4}
          inputMode="numeric"
        />
      </div>
      <div className={styles.footer}>
        {!suggestForUserId && (
          <span className={styles.privacySuggestion}>
            {lang('BirthdayPrivacySuggestion', {
              link: (
                <Link isPrimary onClick={handlePrivacyClick}>
                  {lang('BirthdayPrivacySuggestionLink', undefined,
                    { withNodes: true, specialReplacement: NEXT_ARROW_REPLACEMENT })}
                </Link>
              ),
            }, { withNodes: true })}
          </span>
        )}
        {isFromSuggestion && Boolean(year) && (
          <Button isText onClick={handleHideYear}>
            {lang('BirthdayHideYear')}
          </Button>
        )}
        {currentBirthday && !suggestForUserId && !isFromSuggestion && (
          <Button isText onClick={handleRemove}>
            {lang('BirthdayRemove')}
          </Button>
        )}
        <Button
          disabled={!day || !month}
          onClick={handleSubmit}
        >
          {isFromSuggestion ? lang('BirthdayAddToProfile')
            : suggestForUserId ? lang('BirthdaySuggest')
              : lang('Save')}
        </Button>
      </div>
    </Modal>
  );
};

const getMaxMonthDay = (month?: number, year?: number) => {
  if (!month) return 31;
  if (month === 2) {
    const isLeapYear = year ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) : true;
    return isLeapYear ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const { suggestForUserId } = modal || {};
    const suggestForUser = suggestForUserId ? selectUser(global, suggestForUserId) : undefined;

    return {
      suggestForUser,
    };
  },
)(BirthdaySetupModal));
