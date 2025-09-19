import type React from '../../../lib/teact/teact';
import {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AnimationLevel, PerformanceType, PerformanceTypeKey } from '../../../types';
import type { RegularLangKey } from '../../../types/language';

import {
  ANIMATION_LEVEL_CUSTOM, ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MED, ANIMATION_LEVEL_MIN,
} from '../../../config';
import {
  INITIAL_PERFORMANCE_STATE_MAX,
  INITIAL_PERFORMANCE_STATE_MED,
  INITIAL_PERFORMANCE_STATE_MIN,
} from '../../../global/initialState';
import { selectPerformanceSettings } from '../../../global/selectors';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { IS_BACKDROP_BLUR_SUPPORTED, IS_SNAP_EFFECT_SUPPORTED } from '../../../util/browser/windowEnvironment';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type PerformanceSection = [RegularLangKey, PerformanceOption[]];
type PerformanceOption = {
  key: PerformanceTypeKey;
  label: RegularLangKey;
  disabled?: boolean;
};

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  performanceSettings: PerformanceType;
};

const ANIMATION_LEVEL_OPTIONS: RegularLangKey[] = [
  'SettingsPerformanceSliderLow',
  'SettingsPerformanceSliderMedium',
  'SettingsPerformanceSliderHigh',
];

const ANIMATION_LEVEL_CUSTOM_OPTIONS: RegularLangKey[] = [
  'SettingsPerformanceSliderLow',
  'SettingsPerformanceSliderCustom',
  'SettingsPerformanceSliderHigh',
];

const PERFORMANCE_OPTIONS: PerformanceSection[] = [
  ['SettingsPerformanceInterfaceAnimations', [
    { key: 'pageTransitions', label: 'SettingsPerformancePageTransitions' },
    { key: 'messageSendingAnimations', label: 'SettingsPerformanceSending' },
    { key: 'mediaViewerAnimations', label: 'SettingsPerformanceMediaViewer' },
    { key: 'messageComposerAnimations', label: 'SettingsPerformanceComposer' },
    { key: 'contextMenuAnimations', label: 'SettingsPerformanceContextAnimation' },
    { key: 'contextMenuBlur', label: 'SettingsPerformanceContextBlur', disabled: !IS_BACKDROP_BLUR_SUPPORTED },
    { key: 'rightColumnAnimations', label: 'SettingsPerformanceRightColumn' },
    { key: 'snapEffect', label: 'SettingsPerformanceThanos' },
  ]],
  ['SettingsPerformanceStickers', [
    { key: 'animatedEmoji', label: 'SettingsPerformanceAnimatedEmoji' },
    { key: 'loopAnimatedStickers', label: 'SettingsPerformanceLoopStickers' },
    { key: 'reactionEffects', label: 'SettingsPerformanceReactionEffects' },
    { key: 'stickerEffects', label: 'SettingsPerformanceStickerEffects' },
  ]],
  ['SettingsPerformanceMediaAutoplay', [
    { key: 'autoplayGifs', label: 'SettingsPerformanceAutoplayGif' },
    { key: 'autoplayVideos', label: 'SettingsPerformanceAutoplayVideo' },
  ]],
];

function SettingsPerformance({
  isActive,
  performanceSettings,
  onReset,
}: OwnProps & StateProps) {
  const {
    setSharedSettingOption,
    updatePerformanceSettings,
  } = getActions();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const lang = useLang();
  const [sectionExpandedStates, setSectionExpandedStates] = useState<Record<number, boolean>>({});

  const sectionCheckedStates = useMemo(() => {
    return PERFORMANCE_OPTIONS.reduce((acc, [, options], index) => {
      acc[index] = options.every(({ key }) => performanceSettings[key]);

      return acc;
    }, {} as Record<number, boolean>);
  }, [performanceSettings]);

  const animationLevelState = useMemo(() => {
    if (areDeepEqual(performanceSettings, INITIAL_PERFORMANCE_STATE_MAX)) {
      return ANIMATION_LEVEL_MAX;
    }
    if (areDeepEqual(performanceSettings, INITIAL_PERFORMANCE_STATE_MIN)) {
      return ANIMATION_LEVEL_MIN;
    }
    if (areDeepEqual(performanceSettings, INITIAL_PERFORMANCE_STATE_MED)) {
      return ANIMATION_LEVEL_MED;
    }

    return ANIMATION_LEVEL_CUSTOM;
  }, [performanceSettings]);

  const animationLevelOptions = useMemo(() => {
    const options = animationLevelState === ANIMATION_LEVEL_CUSTOM
      ? ANIMATION_LEVEL_CUSTOM_OPTIONS
      : ANIMATION_LEVEL_OPTIONS;

    return options.map((option) => lang(option));
  }, [animationLevelState, lang]);

  const handleToggleSection = useCallback((e: React.MouseEvent, index?: string) => {
    e.preventDefault();
    const sectionIndex = Number(index);

    setSectionExpandedStates((prev) => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex],
    }));
  }, []);

  const handleAnimationLevelChange = useCallback((newLevel: number) => {
    const performance = newLevel === ANIMATION_LEVEL_MIN
      ? INITIAL_PERFORMANCE_STATE_MIN
      : (newLevel === ANIMATION_LEVEL_MED ? INITIAL_PERFORMANCE_STATE_MED : INITIAL_PERFORMANCE_STATE_MAX);

    setSharedSettingOption({ animationLevel: newLevel as AnimationLevel, wasAnimationLevelSetManually: true });
    updatePerformanceSettings(performance);
  }, []);

  const handlePropertyGroupChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    const perfomanceSection = PERFORMANCE_OPTIONS.find(([sectionName]) => sectionName === name);
    if (!perfomanceSection) {
      return;
    }

    const newSettings = perfomanceSection[1].reduce((acc, { key }) => {
      acc[key] = checked;
      return acc;
    }, {} as Partial<PerformanceType>);

    updatePerformanceSettings(newSettings);
  }, []);

  const handlePropertyChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;

    updatePerformanceSettings({ [name as PerformanceTypeKey]: checked });
  }, []);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('SettingsPerformanceSliderTitle')}
        </h4>
        <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('SettingsPerformanceSliderSubtitle')}
        </p>

        <RangeSlider
          options={animationLevelOptions}
          value={animationLevelState === ANIMATION_LEVEL_CUSTOM ? ANIMATION_LEVEL_MED : animationLevelState}
          onChange={handleAnimationLevelChange}
        />
      </div>

      <div className="settings-item-simple settings-item__with-shifted-dropdown">
        <h3 className="settings-item-header" dir="auto">{lang('SettingsPerformanceGranularTitle')}</h3>

        {PERFORMANCE_OPTIONS.map(([sectionName, options], index) => {
          return (
            <div
              key={sectionName}
              className="settings-dropdown-section"
            >
              <div className="ListItem with-checkbox">
                <Checkbox
                  name={sectionName}
                  value={index.toString()}
                  checked={sectionCheckedStates[index]}
                  label={lang(sectionName)}
                  rightIcon={sectionExpandedStates[index] ? 'up' : 'down'}
                  onChange={handlePropertyGroupChange}
                  onClickLabel={handleToggleSection}
                />
              </div>
              {Boolean(sectionExpandedStates[index]) && (
                <div className="DropdownList DropdownList--open">
                  {options.map(({ key, label, disabled }) => {
                    if (key === 'snapEffect' && !IS_SNAP_EFFECT_SUPPORTED) return undefined;
                    return (
                      <Checkbox
                        key={key}
                        name={key}
                        checked={performanceSettings[key]}
                        label={lang(label)}
                        disabled={disabled}
                        onChange={handlePropertyChange}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  return {
    performanceSettings: selectPerformanceSettings(global),
  };
})(SettingsPerformance));
