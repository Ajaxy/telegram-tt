import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';

import type { ApiFormattedText } from '../../../api/types';
import type { FormattedDateEntityOptions } from '../../../util/dates/formattedDate';

import buildClassName from '../../../util/buildClassName';
import {
  buildFormattedDateText,
  formatFormattedDateText,
  getCanonicalFormattedDate,
  getDefaultFormattedDateText,
} from '../../../util/dates/formattedDate';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CalendarModal from '../../common/CalendarModal.async';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';
import Modal from '../../ui/Modal';
import TabList from '../../ui/TabList';

import styles from './FormattedDateModal.module.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
  onSubmit: (text: ApiFormattedText) => void;
};

const FormattedDateModal = ({
  isOpen,
  onClose,
  onSubmit,
}: OwnProps) => {
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();
  const [selectedDateAt, setSelectedDateAt] = useState(() => roundDateToMinute(new Date()).getTime());
  const [formattedDateOptions, setFormattedDateOptions] = useState<FormattedDateOptionsState>(
    DEFAULT_FORMATTED_DATE_OPTIONS,
  );

  const lang = useLang();

  useEffect(() => {
    if (!isOpen) {
      closeCalendar();
      return;
    }

    setSelectedDateAt(roundDateToMinute(new Date()).getTime());
    setFormattedDateOptions(DEFAULT_FORMATTED_DATE_OPTIONS);
  }, [closeCalendar, isOpen]);

  const unix = useMemo(() => Math.round(selectedDateAt / 1000), [selectedDateAt]);

  const modeTabs = useMemo(() => ([
    { title: lang('FormattedDateRelative') },
    { title: lang('FormattedDateAbsolute') },
  ]), [lang]);
  const formatTabs = useMemo(() => ([
    { title: lang('FormattedDateNone') },
    { title: lang('FormattedDateShort') },
    { title: lang('FormattedDateLong') },
  ]), [lang]);

  const formattedDateEntityOptions = buildFormattedDateEntityOptions(formattedDateOptions);
  const previewText = useMemo(() => formatFormattedDateText(
    lang,
    unix,
    formattedDateEntityOptions,
  ), [formattedDateEntityOptions, lang, unix]);
  const canonicalDate = useMemo(() => getCanonicalFormattedDate(lang, unix), [lang, unix]);

  const areOtherDateOptionsDisabled = formattedDateOptions.relative;
  const activeModeTab = formattedDateOptions.relative ? 0 : 1;
  const activeDateTab = DATE_STYLE_TAB_VALUES.indexOf(formattedDateOptions.dateStyle);
  const activeTimeTab = TIME_STYLE_TAB_VALUES.indexOf(formattedDateOptions.timeStyle);

  const handleModeTabChange = useLastCallback((index: number) => {
    setFormattedDateOptions((current) => ({
      ...current,
      relative: index === 0,
    }));
  });

  const handleDayOfWeekChange = useLastCallback((isChecked: boolean) => {
    setFormattedDateOptions((current) => ({
      ...current,
      dayOfWeek: isChecked,
    }));
  });

  const handleDateStyleChange = useLastCallback((index: number) => {
    if (areOtherDateOptionsDisabled) {
      return;
    }

    setFormattedDateOptions((current) => ({
      ...current,
      dateStyle: DATE_STYLE_TAB_VALUES[index],
    }));
  });

  const handleTimeStyleChange = useLastCallback((index: number) => {
    if (areOtherDateOptionsDisabled) {
      return;
    }

    setFormattedDateOptions((current) => ({
      ...current,
      timeStyle: TIME_STYLE_TAB_VALUES[index],
    }));
  });

  const handleSubmit = useLastCallback(() => {
    onSubmit(buildFormattedDateText(getDefaultFormattedDateText(lang, unix), unix, formattedDateEntityOptions));
    onClose();
  });

  const handleCalendarSubmit = useLastCallback((date: Date) => {
    setSelectedDateAt(date.getTime());
    closeCalendar();
  });

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        onEnter={handleSubmit}
        title={lang('FormattedDateModalTitle')}
        dialogClassName={styles.root}
        isSlim
        hasCloseButton
      >
        <div className={styles.island}>
          <InputText
            className={styles.previewInput}
            label={lang('FormattedDatePreview')}
            value={previewText || getDefaultFormattedDateText(lang, unix)}
            readOnly
            title={canonicalDate}
            onClick={openCalendar}
          />
        </div>

        <div className={styles.options}>
          <TabList
            className={buildClassName(styles.tabList, styles.modeTabList)}
            tabs={modeTabs}
            activeTab={activeModeTab}
            onSwitchTab={handleModeTabChange}
          />

          <div className={styles.tabGroup}>
            <div className={styles.groupLabel}>{lang('FormattedDateDate')}</div>
            <TabList
              className={buildClassName(styles.tabList, areOtherDateOptionsDisabled && styles.tabListDisabled)}
              tabs={formatTabs}
              activeTab={activeDateTab}
              onSwitchTab={handleDateStyleChange}
            />
          </div>

          <div className={styles.tabGroup}>
            <div className={styles.groupLabel}>{lang('FormattedDateTime')}</div>
            <TabList
              className={buildClassName(styles.tabList, areOtherDateOptionsDisabled && styles.tabListDisabled)}
              tabs={formatTabs}
              activeTab={activeTimeTab}
              onSwitchTab={handleTimeStyleChange}
            />
          </div>

          <div className={styles.checkboxRow}>
            <Checkbox
              label={lang('FormattedDateDayOfWeek')}
              checked={formattedDateOptions.dayOfWeek}
              disabled={areOtherDateOptionsDisabled}
              onCheck={handleDayOfWeekChange}
            />
          </div>
        </div>

        <div className="dialog-buttons mt-2">
          <Button className="confirm-dialog-button" onClick={handleSubmit}>
            {lang('Save')}
          </Button>
          <Button className="confirm-dialog-button" isText onClick={onClose}>
            {lang('Cancel')}
          </Button>
        </div>
      </Modal>

      <CalendarModal
        isOpen={isOpen && isCalendarOpen}
        selectedAt={selectedDateAt}
        withTimePicker
        submitButtonLabel={lang('Save')}
        onClose={closeCalendar}
        onSubmit={handleCalendarSubmit}
      />
    </>
  );
};

export default memo(FormattedDateModal);

type DateStyle = 'none' | 'short' | 'long';
type TimeStyle = 'none' | 'short' | 'long';
type FormattedDateOptionsState = {
  relative: boolean;
  dayOfWeek: boolean;
  dateStyle: DateStyle;
  timeStyle: TimeStyle;
};

const DEFAULT_FORMATTED_DATE_OPTIONS: FormattedDateOptionsState = {
  relative: false,
  dayOfWeek: false,
  dateStyle: 'long',
  timeStyle: 'short',
};
const DATE_STYLE_TAB_VALUES: DateStyle[] = ['none', 'short', 'long'];
const TIME_STYLE_TAB_VALUES: TimeStyle[] = ['none', 'short', 'long'];

function roundDateToMinute(date: Date) {
  const nextDate = new Date(date.getTime());
  nextDate.setSeconds(0);
  nextDate.setMilliseconds(0);
  return nextDate;
}

function buildFormattedDateEntityOptions(options: FormattedDateOptionsState): FormattedDateEntityOptions {
  if (options.relative) {
    return { relative: true };
  }

  return {
    dayOfWeek: options.dayOfWeek || undefined,
    shortDate: options.dateStyle === 'short' ? true : undefined,
    longDate: options.dateStyle === 'long' ? true : undefined,
    shortTime: options.timeStyle === 'short' ? true : undefined,
    longTime: options.timeStyle === 'long' ? true : undefined,
  };
}
