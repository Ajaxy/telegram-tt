import type { FC } from '../../../lib/teact/teact';
import React, {
  useCallback, memo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ISettings, TimeFormat } from '../../../types';
import { SettingsScreens } from '../../../types';
import type { ApiSticker, ApiStickerSet } from '../../../api/types';

import {
  getSystemTheme, IS_IOS, IS_MAC_OS, IS_TOUCH_ENV,
} from '../../../util/environment';
import { pick } from '../../../util/iteratees';
import { setTimeFormat } from '../../../util/langProvider';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import RangeSlider from '../../ui/RangeSlider';
import Checkbox from '../../ui/Checkbox';
import type { IRadioOption } from '../../ui/RadioGroup';
import RadioGroup from '../../ui/RadioGroup';
import SettingsStickerSet from './SettingsStickerSet';
import StickerSetModal from '../../common/StickerSetModal.async';
import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import switchTheme from '../../../util/switchTheme';
import { ANIMATION_LEVEL_MAX } from '../../../config';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps =
  Pick<ISettings, (
    'messageTextSize' |
    'animationLevel' |
    'messageSendKeyCombo' |
    'shouldSuggestStickers' |
    'shouldLoopStickers' |
    'timeFormat'
  )> & {
    stickerSetIds?: string[];
    stickerSetsById?: Record<string, ApiStickerSet>;
    defaultReaction?: string;
    theme: ISettings['theme'];
    shouldUseSystemTheme: boolean;
  };

const ANIMATION_LEVEL_OPTIONS = [
  'Solid and Steady',
  'Nice and Fast',
  'Lots of Stuff',
];

const TIME_FORMAT_OPTIONS: IRadioOption[] = [{
  label: '12-hour',
  value: '12h',
}, {
  label: '24-hour',
  value: '24h',
}];

const SettingsGeneral: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  stickerSetIds,
  stickerSetsById,
  defaultReaction,
  messageTextSize,
  animationLevel,
  messageSendKeyCombo,
  shouldSuggestStickers,
  shouldLoopStickers,
  timeFormat,
  theme,
  shouldUseSystemTheme,
}) => {
  const {
    setSettingOption,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const stickerSettingsRef = useRef<HTMLDivElement>(null);
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({ rootRef: stickerSettingsRef });
  const [isModalOpen, openModal, closeModal] = useFlag();
  const [sticker, setSticker] = useState<ApiSticker>();

  const lang = useLang();

  const APPEARANCE_THEME_OPTIONS: IRadioOption[] = [{
    label: lang('EmptyChat.Appearance.Light'),
    value: 'light',
  }, {
    label: lang('EmptyChat.Appearance.Dark'),
    value: 'dark',
  }, {
    label: lang('EmptyChat.Appearance.System'),
    value: 'auto',
  }];

  const KEYBOARD_SEND_OPTIONS = !IS_TOUCH_ENV ? [
    { value: 'enter', label: lang('lng_settings_send_enter'), subLabel: 'New line by Shift + Enter' },
    {
      value: 'ctrl-enter',
      label: lang(IS_MAC_OS ? 'lng_settings_send_cmdenter' : 'lng_settings_send_ctrlenter'),
      subLabel: 'New line by Enter',
    },
  ] : undefined;

  const handleAnimationLevelChange = useCallback((newLevel: number) => {
    ANIMATION_LEVEL_OPTIONS.forEach((_, i) => {
      document.body.classList.toggle(`animation-level-${i}`, newLevel === i);
    });

    setSettingOption({ animationLevel: newLevel });
  }, [setSettingOption]);

  const handleMessageTextSizeChange = useCallback((newSize: number) => {
    document.documentElement.style.setProperty(
      '--composer-text-size', `${Math.max(newSize, IS_IOS ? 16 : 15)}px`,
    );
    document.documentElement.style.setProperty('--message-meta-height', `${Math.floor(newSize * 1.3125)}px`);
    document.documentElement.style.setProperty('--message-text-size', `${newSize}px`);
    document.documentElement.setAttribute('data-message-text-size', newSize.toString());

    setSettingOption({ messageTextSize: newSize });
  }, [setSettingOption]);

  const handleAppearanceThemeChange = useCallback((value: string) => {
    const newTheme = value === 'auto' ? getSystemTheme() : value as ISettings['theme'];

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: value === 'auto' });
    if (newTheme !== theme) {
      switchTheme(newTheme, animationLevel === ANIMATION_LEVEL_MAX);
    }
  }, [animationLevel, setSettingOption, theme]);

  const handleTimeFormatChange = useCallback((newTimeFormat: string) => {
    setSettingOption({ timeFormat: newTimeFormat });
    setSettingOption({ wasTimeFormatSetManually: true });

    setTimeFormat(newTimeFormat as TimeFormat);
  }, [setSettingOption]);

  const handleStickerSetClick = useCallback((value: ApiSticker) => {
    setSticker(value);
    openModal();
  }, [openModal]);

  const handleMessageSendComboChange = useCallback((newCombo: string) => {
    setSettingOption({ messageSendKeyCombo: newCombo });
  }, [setSettingOption]);

  const handleSuggestStickersChange = useCallback((newValue: boolean) => {
    setSettingOption({ shouldSuggestStickers: newValue });
  }, [setSettingOption]);

  const handleShouldLoopStickersChange = useCallback((newValue: boolean) => {
    setSettingOption({ shouldLoopStickers: newValue });
  }, [setSettingOption]);

  const stickerSets = stickerSetIds && stickerSetIds.map((id: string) => {
    return stickerSetsById?.[id]?.installedDate ? stickerSetsById[id] : false;
  }).filter<ApiStickerSet>(Boolean as any);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item pt-3">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('SETTINGS')}</h4>

        <RangeSlider
          label={lang('TextSize')}
          min={12}
          max={20}
          value={messageTextSize}
          onChange={handleMessageTextSizeChange}
        />

        <ListItem
          icon="photo"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.GeneralChatBackground)}
        >
          {lang('ChatBackground')}
        </ListItem>
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('Theme')}
        </h4>
        <RadioGroup
          name="theme"
          options={APPEARANCE_THEME_OPTIONS}
          selected={shouldUseSystemTheme ? 'auto' : theme}
          onChange={handleAppearanceThemeChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          Time Format
        </h4>
        <RadioGroup
          name="timeformat"
          options={TIME_FORMAT_OPTIONS}
          selected={timeFormat}
          onChange={handleTimeFormatChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          Animation Level
        </h4>
        <p className="settings-item-description" dir={lang.isRtl ? 'rtl' : undefined}>
          Choose the desired animations amount.
        </p>

        <RangeSlider
          options={ANIMATION_LEVEL_OPTIONS}
          value={animationLevel}
          onChange={handleAnimationLevelChange}
        />
      </div>

      {KEYBOARD_SEND_OPTIONS && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('VoiceOver.Keyboard')}</h4>

          <RadioGroup
            name="keyboard-send-settings"
            options={KEYBOARD_SEND_OPTIONS}
            onChange={handleMessageSendComboChange}
            selected={messageSendKeyCombo}
          />
        </div>
      )}

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('AccDescrStickers')}</h4>

        {defaultReaction && (
          <ListItem
            className="SettingsDefaultReaction"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => onScreenSelect(SettingsScreens.QuickReaction)}
          >
            <ReactionStaticEmoji reaction={defaultReaction} />
            <div className="title">{lang('DoubleTapSetting')}</div>
          </ListItem>
        )}

        <Checkbox
          label={lang('SuggestStickers')}
          checked={shouldSuggestStickers}
          onCheck={handleSuggestStickersChange}
        />
        <Checkbox
          label={lang('LoopAnimatedStickers')}
          checked={shouldLoopStickers}
          onCheck={handleShouldLoopStickersChange}
        />

        <div className="mt-4" ref={stickerSettingsRef}>
          {stickerSets && stickerSets.map((stickerSet: ApiStickerSet) => (
            <SettingsStickerSet
              key={stickerSet.id}
              stickerSet={stickerSet}
              observeIntersection={observeIntersectionForCovers}
              onClick={handleStickerSetClick}
            />
          ))}
        </div>
        {sticker && (
          <StickerSetModal
            isOpen={isModalOpen}
            fromSticker={sticker}
            onClose={closeModal}
          />
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { theme, shouldUseSystemTheme } = global.settings.byKey;

    return {
      ...pick(global.settings.byKey, [
        'messageTextSize',
        'animationLevel',
        'messageSendKeyCombo',
        'shouldSuggestStickers',
        'shouldLoopStickers',
        'isSensitiveEnabled',
        'canChangeSensitive',
        'timeFormat',
      ]),
      stickerSetIds: global.stickers.added.setIds,
      stickerSetsById: global.stickers.setsById,
      defaultReaction: global.appConfig?.defaultReaction,
      theme,
      shouldUseSystemTheme,
    };
  },
)(SettingsGeneral));
