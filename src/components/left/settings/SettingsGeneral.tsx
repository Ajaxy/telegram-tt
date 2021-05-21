import React, {
  FC, useCallback, memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { SettingsScreens, ISettings } from '../../../types';
import { ApiSticker, ApiStickerSet } from '../../../api/types';

import { IS_MAC_OS, IS_TOUCH_ENV } from '../../../util/environment';
import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';

import ListItem from '../../ui/ListItem';
import RangeSlider from '../../ui/RangeSlider';
import Checkbox from '../../ui/Checkbox';
import RadioGroup from '../../ui/RadioGroup';
import SettingsStickerSet from './SettingsStickerSet';
import StickerSetModal from '../../common/StickerSetModal.async';

type OwnProps = {
  onScreenSelect: (screen: SettingsScreens) => void;
};

type StateProps = ISettings['byKey'] & {
  stickerSetIds?: string[];
  stickerSetsById?: Record<string, ApiStickerSet>;
};

type DispatchProps = Pick<GlobalActions, 'setSettingOption' | 'loadStickerSets' | 'loadAddedStickers'>;

const ANIMATION_LEVEL_OPTIONS = [
  'Solid and Steady',
  'Nice and Fast',
  'Lots of Stuff',
];

const SettingsGeneral: FC<OwnProps & StateProps & DispatchProps> = ({
  onScreenSelect,
  stickerSetIds,
  stickerSetsById,
  messageTextSize,
  animationLevel,
  messageSendKeyCombo,
  shouldAutoDownloadMediaFromContacts,
  shouldAutoDownloadMediaInPrivateChats,
  shouldAutoDownloadMediaInGroups,
  shouldAutoDownloadMediaInChannels,
  shouldAutoPlayGifs,
  shouldAutoPlayVideos,
  shouldSuggestStickers,
  shouldLoopStickers,
  setSettingOption,
  loadStickerSets,
  loadAddedStickers,
}) => {
  // eslint-disable-next-line no-null/no-null
  const stickerSettingsRef = useRef<HTMLDivElement>(null);
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({ rootRef: stickerSettingsRef });
  const [isModalOpen, openModal, closeModal] = useFlag();
  const [sticker, setSticker] = useState<ApiSticker>();

  const lang = useLang();

  const KEYBOARD_SEND_OPTIONS = !IS_TOUCH_ENV ? [
    { value: 'enter', label: lang('lng_settings_send_enter'), subLabel: 'New line by Shift + Enter' },
    {
      value: 'ctrl-enter',
      label: lang(IS_MAC_OS ? 'lng_settings_send_cmdenter' : 'lng_settings_send_ctrlenter'),
      subLabel: 'New line by Enter',
    },
  ] : undefined;

  useEffect(() => {
    loadStickerSets();
  }, [loadStickerSets]);

  useEffect(() => {
    if (stickerSetIds && stickerSetIds.length) {
      loadAddedStickers();
    }
  }, [stickerSetIds, loadAddedStickers]);

  const handleAnimationLevelChange = useCallback((newLevel: number) => {
    ANIMATION_LEVEL_OPTIONS.forEach((_, i) => {
      document.body.classList.toggle(`animation-level-${i}`, newLevel === i);
    });

    setSettingOption({ animationLevel: newLevel });
  }, [setSettingOption]);

  const handleMessageTextSizeChange = useCallback((newSize: number) => {
    document.documentElement.style.setProperty('--message-text-size', `${newSize}px`);

    setSettingOption({ messageTextSize: newSize });
  }, [setSettingOption]);

  const handleStickerSetClick = useCallback((value: ApiSticker) => {
    setSticker(value);
    openModal();
  }, [openModal]);

  const stickerSets = stickerSetIds && stickerSetIds.map((id: string) => {
    return stickerSetsById && stickerSetsById[id] && stickerSetsById[id].installedDate ? stickerSetsById[id] : false;
  }).filter(Boolean);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item pt-3">
        <h4 className="settings-item-header">{lang('SETTINGS')}</h4>

        <RangeSlider
          label={lang('TextSize')}
          // TODO Remove memo-killer
          range={{ min: 12, max: 20 }}
          value={messageTextSize}
          onChange={handleMessageTextSizeChange}
        />

        <ListItem
          icon="photo"
          onClick={() => onScreenSelect(SettingsScreens.GeneralChatBackground)}
        >
          {lang('ChatBackground')}
        </ListItem>
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">
          Animation Level
        </h4>
        <p className="settings-item-description">Choose the desired animations amount.</p>

        <RangeSlider
          options={ANIMATION_LEVEL_OPTIONS}
          value={animationLevel}
          onChange={handleAnimationLevelChange}
        />
      </div>

      {KEYBOARD_SEND_OPTIONS && (
        <div className="settings-item">
          <h4 className="settings-item-header">{lang('Keyboard')}</h4>

          <RadioGroup
            name="keyboard-send-settings"
            options={KEYBOARD_SEND_OPTIONS}
            onChange={(value) => setSettingOption({ messageSendKeyCombo: value })}
            selected={messageSendKeyCombo}
          />
        </div>
      )}

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('AutoDownloadMedia')}</h4>

        <Checkbox
          label={lang('Contacts')}
          checked={shouldAutoDownloadMediaFromContacts}
          onCheck={(isChecked) => setSettingOption({ shouldAutoDownloadMediaFromContacts: isChecked })}
        />
        <Checkbox
          label={lang('AutodownloadPrivateChats')}
          checked={shouldAutoDownloadMediaInPrivateChats}
          onCheck={(isChecked) => setSettingOption({ shouldAutoDownloadMediaInPrivateChats: isChecked })}
        />
        <Checkbox
          label={lang('AutodownloadGroupChats')}
          checked={shouldAutoDownloadMediaInGroups}
          onCheck={(isChecked) => setSettingOption({ shouldAutoDownloadMediaInGroups: isChecked })}
        />
        <Checkbox
          label={lang('FilterChannels')}
          checked={shouldAutoDownloadMediaInChannels}
          onCheck={(isChecked) => setSettingOption({ shouldAutoDownloadMediaInChannels: isChecked })}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('AutoplayMedia')}</h4>

        <Checkbox
          label={lang('GifsTab2')}
          checked={shouldAutoPlayGifs}
          onCheck={(isChecked) => setSettingOption({ shouldAutoPlayGifs: isChecked })}
        />
        <Checkbox
          label={lang('VideosTitle')}
          checked={shouldAutoPlayVideos}
          onCheck={(isChecked) => setSettingOption({ shouldAutoPlayVideos: isChecked })}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('AccDescrStickers')}</h4>

        <Checkbox
          label={lang('SuggestStickers')}
          checked={shouldSuggestStickers}
          onCheck={(isChecked) => setSettingOption({ shouldSuggestStickers: isChecked })}
        />
        <Checkbox
          label={lang('LoopAnimatedStickers')}
          checked={shouldLoopStickers}
          onCheck={(isChecked) => setSettingOption({ shouldLoopStickers: isChecked })}
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
    return {
      ...pick(global.settings.byKey,
        [
          'messageTextSize',
          'animationLevel',
          'messageSendKeyCombo',
          'shouldAutoDownloadMediaFromContacts',
          'shouldAutoDownloadMediaInPrivateChats',
          'shouldAutoDownloadMediaInGroups',
          'shouldAutoDownloadMediaInChannels',
          'shouldAutoPlayGifs',
          'shouldAutoPlayVideos',
          'shouldSuggestStickers',
          'shouldLoopStickers',
        ]),
      stickerSetIds: global.stickers.added.setIds,
      stickerSetsById: global.stickers.setsById,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setSettingOption', 'loadStickerSets', 'loadAddedStickers',
  ]),
)(SettingsGeneral));
