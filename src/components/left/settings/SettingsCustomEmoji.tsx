import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker, ApiStickerSet } from '../../../api/types';
import type { ISettings } from '../../../types';

import renderText from '../../common/helpers/renderText';
import { pick } from '../../../util/iteratees';

import useHistoryBack from '../../../hooks/useHistoryBack';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';

import StickerSetCard from '../../common/StickerSetCard';
import Checkbox from '../../ui/Checkbox';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = Pick<ISettings, (
  'shouldSuggestCustomEmoji'
)> & {
  customEmojiSetIds?: string[];
  stickerSetsById: Record<string, ApiStickerSet>;
};

const SettingsCustomEmoji: FC<OwnProps & StateProps> = ({
  isActive,
  customEmojiSetIds,
  stickerSetsById,
  shouldSuggestCustomEmoji,
  onReset,
}) => {
  const { openStickerSet, setSettingOption } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const stickerSettingsRef = useRef<HTMLDivElement>(null);
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({ rootRef: stickerSettingsRef });

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleStickerSetClick = useCallback((sticker: ApiSticker) => {
    openStickerSet({
      stickerSetInfo: sticker.stickerSetInfo,
    });
  }, [openStickerSet]);

  const handleSuggestCustomEmojiChange = useCallback((newValue: boolean) => {
    setSettingOption({ shouldSuggestCustomEmoji: newValue });
  }, [setSettingOption]);

  const customEmojiSets = useMemo(() => (
    customEmojiSetIds && Object.values(pick(stickerSetsById, customEmojiSetIds))
  ), [customEmojiSetIds, stickerSetsById]);

  return (
    <div className="settings-content custom-scroll">
      {customEmojiSets && (
        <div className="settings-item">
          <Checkbox
            label={lang('SuggestAnimatedEmoji')}
            checked={shouldSuggestCustomEmoji}
            onCheck={handleSuggestCustomEmojiChange}
          />
          <div className="mt-4" ref={stickerSettingsRef}>
            {customEmojiSets.map((stickerSet: ApiStickerSet) => (
              <StickerSetCard
                key={stickerSet.id}
                stickerSet={stickerSet}
                observeIntersection={observeIntersectionForCovers}
                onClick={handleStickerSetClick}
              />
            ))}
          </div>
          <p className="settings-item-description mt-3" dir="auto">
            {renderText(lang('EmojiBotInfo'), ['links'])}
          </p>
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global) => {
    return {
      ...pick(global.settings.byKey, [
        'shouldSuggestCustomEmoji',
      ]),
      customEmojiSetIds: global.customEmojis.added.setIds,
      stickerSetsById: global.stickers.setsById,
    };
  },
)(SettingsCustomEmoji));
