import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import { SettingsScreens } from '../../../types';
import type { ISettings } from '../../../types';
import type { ApiSticker, ApiStickerSet } from '../../../api/types';

import renderText from '../../common/helpers/renderText';
import { pick } from '../../../util/iteratees';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import ReactionStaticEmoji from '../../common/ReactionStaticEmoji';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';
import StickerSetCard from '../../common/StickerSetCard';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps =
  Pick<ISettings, (
    'shouldSuggestStickers' |
    'shouldLoopStickers'
  )> & {
    addedSetIds?: string[];
    customEmojiSetIds?: string[];
    stickerSetsById: Record<string, ApiStickerSet>;
    defaultReaction?: string;
  };

const SettingsStickers: FC<OwnProps & StateProps> = ({
  isActive,
  addedSetIds,
  customEmojiSetIds,
  stickerSetsById,
  defaultReaction,
  shouldSuggestStickers,
  shouldLoopStickers,
  onReset,
  onScreenSelect,
}) => {
  const {
    setSettingOption,
    openStickerSet,
  } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const stickerSettingsRef = useRef<HTMLDivElement>(null);
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({ rootRef: stickerSettingsRef });

  const handleStickerSetClick = useCallback((sticker: ApiSticker) => {
    openStickerSet({
      stickerSetInfo: sticker.stickerSetInfo,
    });
  }, [openStickerSet]);

  const handleSuggestStickersChange = useCallback((newValue: boolean) => {
    setSettingOption({ shouldSuggestStickers: newValue });
  }, [setSettingOption]);

  const handleShouldLoopStickersChange = useCallback((newValue: boolean) => {
    setSettingOption({ shouldLoopStickers: newValue });
  }, [setSettingOption]);

  const stickerSets = useMemo(() => (
    addedSetIds && Object.values(pick(stickerSetsById, addedSetIds))
  ), [addedSetIds, stickerSetsById]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
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
        <ListItem
          className="mt-4"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.CustomEmoji)}
          icon="smile"
        >
          {lang('StickersList.EmojiItem')}
          {customEmojiSetIds && <span className="settings-item__current-value">{customEmojiSetIds.length}</span>}
        </ListItem>
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
      </div>
      {stickerSets && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('ChooseStickerMyStickerSets')}
          </h4>
          <div ref={stickerSettingsRef}>
            {stickerSets.map((stickerSet: ApiStickerSet) => (
              <StickerSetCard
                key={stickerSet.id}
                stickerSet={stickerSet}
                observeIntersection={observeIntersectionForCovers}
                onClick={handleStickerSetClick}
              />
            ))}
          </div>
          <p className="settings-item-description mt-3" dir="auto">
            {renderText(lang('StickersBotInfo'), ['links'])}
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      ...pick(global.settings.byKey, [
        'shouldSuggestStickers',
        'shouldLoopStickers',
      ]),
      addedSetIds: global.stickers.added.setIds,
      customEmojiSetIds: global.customEmojis.added.setIds,
      stickerSetsById: global.stickers.setsById,
      defaultReaction: global.config?.defaultReaction,
    };
  },
)(SettingsStickers));
