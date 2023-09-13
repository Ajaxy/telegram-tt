import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AnimationLevel, PerformanceType, PerformanceTypeKey } from '../../../types';

import {
  ANIMATION_LEVEL_CUSTOM, ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MED, ANIMATION_LEVEL_MIN,
} from '../../../config';
import {
  INITIAL_PERFORMANCE_STATE_MAX,
  INITIAL_PERFORMANCE_STATE_MID,
  INITIAL_PERFORMANCE_STATE_MIN,
} from '../../../global/initialState';
import { selectPerformanceSettings } from '../../../global/selectors';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { IS_BACKDROP_BLUR_SUPPORTED } from '../../../util/windowEnvironment';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type PerformanceSection = [string, PerformanceOption[]];
type PerformanceOption = {
  key: PerformanceTypeKey;
  label: string;
  disabled?: boolean;
};

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  performanceSettings: PerformanceType;
};

const ANIMATION_LEVEL_OPTIONS = [
  'Power Saving',
  'Nice and Fast',
  'Lots of Stuff',
];

const ANIMATION_LEVEL_CUSTOM_OPTIONS = [
  'Power Saving',
  'Custom',
  'Lots of Stuff',
];

const PERFORMANCE_OPTIONS: PerformanceSection[] = [
  ['LiteMode.Key.animations.Title', [
    { key: 'pageTransitions', label: 'Page Transitions' },
    { key: 'messageSendingAnimations', label: 'Message Sending Animation' },
    { key: 'mediaViewerAnimations', label: 'Media Viewer Animations' },
    { key: 'messageComposerAnimations', label: 'Message Composer Animations' },
    { key: 'contextMenuAnimations', label: 'Context Menu Animation' },
    { key: 'contextMenuBlur', label: 'Context Menu Blur', disabled: !IS_BACKDROP_BLUR_SUPPORTED },
    { key: 'rightColumnAnimations', label: 'Right Column Animation' },
  ]],
  ['Stickers and Emoji', [
    { key: 'animatedEmoji', label: 'Allow Animated Emoji' },
    { key: 'loopAnimatedStickers', label: 'Loop Animated Stickers' },
    { key: 'reactionEffects', label: 'Reaction Effects' },
    { key: 'stickerEffects', label: 'Full-Screen Sticker and Emoji Effects' },
  ]],
  ['AutoplayMedia', [
    { key: 'autoplayGifs', label: 'AutoplayGIF' },
    { key: 'autoplayVideos', label: 'AutoplayVideo' },
  ]],
];

function SettingsPerformance({
  isActive,
  performanceSettings,
  onReset,
}: OwnProps & StateProps) {
  const {
    setSettingOption,
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
    if (areDeepEqual(performanceSettings, INITIAL_PERFORMANCE_STATE_MID)) {
      return ANIMATION_LEVEL_MED;
    }

    return ANIMATION_LEVEL_CUSTOM;
  }, [performanceSettings]);
  const animationLevelOptions = animationLevelState === ANIMATION_LEVEL_CUSTOM
    ? ANIMATION_LEVEL_CUSTOM_OPTIONS
    : ANIMATION_LEVEL_OPTIONS;

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
      : (newLevel === ANIMATION_LEVEL_MED ? INITIAL_PERFORMANCE_STATE_MID : INITIAL_PERFORMANCE_STATE_MAX);

    setSettingOption({ animationLevel: newLevel as AnimationLevel });
    updatePerformanceSettings(performance);
  }, [setSettingOption]);

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
          Animation Level
        </h4>
        <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
          Choose the desired animations amount.
        </p>

        <RangeSlider
          options={animationLevelOptions}
          value={animationLevelState === ANIMATION_LEVEL_CUSTOM ? ANIMATION_LEVEL_MED : animationLevelState}
          onChange={handleAnimationLevelChange}
        />
      </div>

      <div className="settings-item-simple settings-item__with-shifted-dropdown">
        <h3 className="settings-item-header" dir="auto">Resource-Intensive Processes</h3>

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
                  {options.map(({ key, label, disabled }) => (
                    <Checkbox
                      key={key}
                      name={key}
                      checked={performanceSettings[key]}
                      label={lang(label)}
                      disabled={disabled}
                      onChange={handlePropertyChange}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    performanceSettings: selectPerformanceSettings(global),
  };
})(SettingsPerformance));
