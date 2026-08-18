import {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getPromiseActions, withGlobal } from '../../../global';

import type { LangFn } from '../../../util/localization';

import { formatCountdown } from '../../../util/dates/oldDateFormat';
import {
  DAY, MONTH, WEEK, YEAR,
} from '../../../util/dates/units';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import Island, { IslandDescription, IslandTitle } from '../../gili/layout/Island';
import DropdownMenu from '../../ui/DropdownMenu';
import ListItem from '../../ui/ListItem';
import MenuItem from '../../ui/MenuItem';
import RadioGroup from '../../ui/RadioGroup';

import styles from './SettingsAutoDeleteMessages.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  defaultHistoryTtl?: number;
};

const DEFAULT_AUTO_DELETE_PERIODS = [0, DAY, WEEK, MONTH];
const CUSTOM_AUTO_DELETE_PERIODS = [
  0,
  DAY,
  2 * DAY,
  3 * DAY,
  4 * DAY,
  5 * DAY,
  6 * DAY,
  WEEK,
  2 * WEEK,
  3 * WEEK,
  MONTH,
  2 * MONTH,
  3 * MONTH,
  4 * MONTH,
  5 * MONTH,
  6 * MONTH,
  YEAR,
];
const TOP_STICKER_SIZE = 120;

const SettingsAutoDeleteMessages = ({
  isActive,
  defaultHistoryTtl,
  onReset,
}: OwnProps & StateProps) => {
  const { setDefaultHistoryTtl } = getPromiseActions();

  const [draftPeriod, setDraftPeriod] = useState<number>();

  const lang = useLang();

  const selectedPeriod = draftPeriod ?? defaultHistoryTtl;

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const options = useMemo(() => buildPeriodOptions(
    lang,
    DEFAULT_AUTO_DELETE_PERIODS,
    selectedPeriod,
    lang('SettingsItemPrivacyOff'),
  ), [lang, selectedPeriod]);

  const customOptions = useMemo(() => buildPeriodOptions(
    lang,
    CUSTOM_AUTO_DELETE_PERIODS,
    selectedPeriod,
    lang('ScheduleRepeatNever'),
  ), [lang, selectedPeriod]);

  const savePeriod = useLastCallback(async (period: number) => {
    setDraftPeriod(period);

    await setDefaultHistoryTtl({ period });

    // Roll the optimistic selection back unless a newer choice is already pending
    setDraftPeriod((current) => (current === period ? undefined : current));
  });

  const handlePeriodChange = useLastCallback((value: string) => {
    void savePeriod(Number(value));
  });

  const handleCustomPeriodChange = useLastCallback((e: React.SyntheticEvent, period?: number) => {
    e.preventDefault();
    void savePeriod(period!);
  });

  const CustomTimeTrigger = useCallback(({ onTrigger, isOpen }: {
    onTrigger: NoneToVoidFunction;
    isOpen?: boolean;
  }) => (
    <ListItem
      icon="tools"
      narrow
      ripple
      focus={isOpen}
      disabled={defaultHistoryTtl === undefined}
      onClick={onTrigger}
    >
      <div className="title">{lang('SetCustomTime')}</div>
    </ListItem>
  ), [defaultHistoryTtl, lang]);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-content-header no-border">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.UtyanDisappear}
          size={TOP_STICKER_SIZE}
          className="settings-content-icon"
        />
      </div>
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('SetAutoDeleteTimer')}
      </IslandTitle>
      <Island>
        <RadioGroup
          name="default_history_ttl"
          options={options}
          selected={selectedPeriod?.toString()}
          disabled={defaultHistoryTtl === undefined}
          onChange={handlePeriodChange}
        />
        <DropdownMenu
          trigger={CustomTimeTrigger}
          bubbleClassName={styles.customTimePicker}
          positionX={lang.isRtl ? 'left' : 'right'}
          positionY="bottom"
          autoClose
          withPortal
        >
          {customOptions.map(({ label, value }) => {
            const period = Number(value);
            return (
              <MenuItem
                key={value}
                icon={period === selectedPeriod ? 'check' : 'placeholder'}
                clickArg={period}
                onClick={handleCustomPeriodChange}
              >
                {label}
              </MenuItem>
            );
          })}
        </DropdownMenu>
      </Island>
      <IslandDescription dir="auto">
        {lang('AutoDeleteSettingsInfo')}
      </IslandDescription>
    </div>
  );
};

function buildPeriodOptions(
  lang: LangFn,
  predefinedPeriods: number[],
  currentPeriod: number | undefined,
  disabledLabel: string,
) {
  const periods = [...predefinedPeriods];

  if (currentPeriod !== undefined && !periods.includes(currentPeriod)) {
    const insertionIndex = periods.findIndex((period) => period > currentPeriod);
    if (insertionIndex === -1) {
      periods.push(currentPeriod);
    } else {
      periods.splice(insertionIndex, 0, currentPeriod);
    }
  }

  return periods.map((period) => ({
    label: period === 0 ? disabledLabel : formatCountdown(lang, period),
    value: String(period),
  }));
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      defaultHistoryTtl: global.settings.byKey.defaultHistoryTtl,
    };
  },
)(SettingsAutoDeleteMessages));
