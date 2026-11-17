import type { ElementRef } from '../../../lib/teact/teact';
import { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiReaction,
  ApiReactionWithPaid,
  ApiSavedStarGift,
  ApiShareThemeBackdrop,
  ApiStarGiftUnique,
  ApiSticker,
} from '../../../api/types';
import type { IconName } from '../../../types/icons';
import type { ShareThemeBackdropOption, ShareThemeDraft } from './helpers/shareTheme';

import { getReactionKey, isSameReaction } from '../../../global/helpers';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getGiftAttributes } from '../../common/helpers/gifts';
import {
  buildBackdropOptions,
  buildEmojiBackdropTheme,
  getShareThemeBackdrop,
  toggleEmojiPick,
} from './helpers/shareTheme';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import CustomEmoji from '../../common/CustomEmoji';
import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Icon from '../../common/icons/Icon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import ReactionStaticEmoji from '../../common/reactions/ReactionStaticEmoji';
import StickerView from '../../common/StickerView';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';

import styles from './QrCodeThemeEditor.module.scss';

export type QrThemePanel = 'colors' | 'emoji' | 'gifts';

type OwnProps = {
  theme: ShareThemeDraft;
  activePanel?: QrThemePanel;
  panelRef: ElementRef<HTMLDivElement>;
  backdrops?: ApiShareThemeBackdrop[];
  uniqueGifts?: ApiSavedStarGift[];
  availableReactions?: ApiAvailableReaction[];
  emojiPresets?: ApiSticker[];
  isCurrentUserPremium?: boolean;
  isSelf?: boolean;
  onPanelChange: (panel?: QrThemePanel) => void;
  onThemeChange: (theme: ShareThemeDraft) => void;
  onLoadMoreGifts: NoneToVoidFunction;
  onBrowseGifts: NoneToVoidFunction;
};

const PANELS: { key: QrThemePanel; icon: IconName; titleKey: 'QrCodeColors' | 'QrCodeEmoji' | 'QrCodeGifts' }[] = [
  { key: 'colors', icon: 'colorize', titleKey: 'QrCodeColors' },
  { key: 'emoji', icon: 'smile', titleKey: 'QrCodeEmoji' },
  { key: 'gifts', icon: 'gift', titleKey: 'QrCodeGifts' },
];

const NO_EMOJIS: ApiReaction[] = [];
const GIFT_STICKER_SIZE = 56;
const PICK_EMOJI_SIZE = 28;
const GIFT_PATTERN_SIZE = 12;

const QrCodeThemeEditor = ({
  theme,
  activePanel,
  panelRef,
  backdrops,
  uniqueGifts,
  availableReactions,
  emojiPresets,
  isCurrentUserPremium,
  isSelf,
  onPanelChange,
  onThemeChange,
  onLoadMoreGifts,
  onBrowseGifts,
}: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const backdropOptions = useMemo(() => buildBackdropOptions(backdrops), [backdrops]);
  const emojis = theme?.type === 'emojiBackdrop' ? theme.emojis : NO_EMOJIS;
  const selectedBackdrop = getShareThemeBackdrop(theme, backdrops);
  const selectedReactionIds = useMemo(() => emojis.map(getReactionKey), [emojis]);
  const presetIds = useMemo(() => new Set(emojiPresets?.map(({ id }) => id)), [emojiPresets]);
  const selectedGiftId = theme?.type === 'gift' ? theme.gift.id : undefined;

  const handleBackdropClick = useLastCallback((option: ShareThemeBackdropOption) => {
    onThemeChange(buildEmojiBackdropTheme(option.backdropId, emojis));
  });

  const handleReactionSelect = useLastCallback((reaction: ApiReactionWithPaid) => {
    if (reaction.type === 'paid') return;

    const isPicked = emojis.some((emoji) => isSameReaction(emoji, reaction));
    if (!isPicked && !isCurrentUserPremium && getIsPremiumReaction(reaction, presetIds, availableReactions)) {
      showNotification({ message: { key: 'PremiumUnlockEmoji' } });
      return;
    }

    const backdropId = theme?.type === 'emojiBackdrop' ? theme.backdropId : undefined;
    onThemeChange(buildEmojiBackdropTheme(backdropId, toggleEmojiPick(emojis, reaction)));
  });

  const handleCustomEmojiSelect = useLastCallback((sticker: ApiSticker) => {
    handleReactionSelect({ type: 'custom', documentId: sticker.id });
  });

  const handleGiftClick = useLastCallback((savedGift: ApiSavedStarGift) => {
    if (savedGift.gift.id === selectedGiftId) {
      onThemeChange(undefined);
      return;
    }

    onThemeChange({
      type: 'gift',
      gift: savedGift.gift as ApiStarGiftUnique,
      inputGift: savedGift.inputGift,
    });
  });

  function renderColors() {
    return (
      <div className={buildClassName(styles.swatches, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}>
        {backdropOptions.map((option) => (
          <button
            key={option.backdropId ?? 'default'}
            type="button"
            className={buildClassName(styles.swatch, option === selectedBackdrop && styles.swatchSelected)}
            style={`--swatch-center: ${option.centerColor}; --swatch-edge: ${option.edgeColor}`}
            aria-label={option.name ?? lang('QrCodeDefaultColor')}
            onClick={() => handleBackdropClick(option)}
          />
        ))}
      </div>
    );
  }

  function renderEmoji() {
    return (
      <>
        <CustomEmojiPicker
          className={styles.emojiPicker}
          pickerListClassName={buildClassName(emojis.length && styles.emojiPickerList)}
          idPrefix="qr-code-emoji-"
          loadAndPlay
          isReactionPicker
          noAddButton
          topCustomEmojis={emojiPresets}
          selectedReactionIds={selectedReactionIds}
          withSelectionOrder
          onCustomEmojiSelect={handleCustomEmojiSelect}
          onReactionSelect={handleReactionSelect}
        />
        {Boolean(emojis.length) && (
          <div className={styles.picks}>
            {emojis.map((reaction) => (
              <button
                key={getReactionKey(reaction)}
                type="button"
                className={styles.pick}
                onClick={() => handleReactionSelect(reaction)}
              >
                {reaction.type === 'custom' ? (
                  <CustomEmoji documentId={reaction.documentId} size={PICK_EMOJI_SIZE} />
                ) : (
                  <ReactionStaticEmoji
                    reaction={reaction}
                    availableReactions={availableReactions}
                    size={PICK_EMOJI_SIZE}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  function renderGifts() {
    if (uniqueGifts && !uniqueGifts.length) {
      return (
        <div className={styles.giftsEmpty}>
          <div className={styles.giftsEmptyTitle}>{lang('QrCodeGiftsEmptyTitle')}</div>
          <div className={styles.giftsEmptyText}>
            {lang(isSelf ? 'QrCodeGiftsEmptyAbout' : 'QrCodeGiftsEmptyAboutChat')}
          </div>
          {isSelf && (
            <Button className={styles.giftsBrowse} size="smaller" onClick={onBrowseGifts}>
              {lang('QrCodeGiftsBrowse')}
            </Button>
          )}
        </div>
      );
    }

    return (
      <InfiniteScroll
        className={buildClassName(styles.gifts, IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
        items={uniqueGifts}
        itemSelector={`.${styles.gift}`}
        onLoadMore={onLoadMoreGifts}
      >
        {uniqueGifts?.map((savedGift) => (
          <QrCodeGiftTile
            key={savedGift.gift.id}
            savedGift={savedGift}
            isSelected={savedGift.gift.id === selectedGiftId}
            onClick={handleGiftClick}
          />
        ))}
      </InfiniteScroll>
    );
  }

  return (
    <>
      <div className={styles.island} inert={Boolean(activePanel)}>
        {PANELS.map(({ key, icon, titleKey }) => (
          <button
            key={key}
            type="button"
            className={buildClassName(styles.islandButton, activePanel === key && styles.islandButtonActive)}
            onClick={() => onPanelChange(activePanel === key ? undefined : key)}
          >
            <Icon name={icon} className={styles.islandIcon} />
            {lang(titleKey)}
          </button>
        ))}
      </div>
      {activePanel && (
        <div ref={panelRef} className={styles.panel}>
          {activePanel === 'colors' && renderColors()}
          {activePanel === 'emoji' && renderEmoji()}
          {activePanel === 'gifts' && renderGifts()}
        </div>
      )}
    </>
  );
};

const QrCodeGiftTile = memo(({
  savedGift,
  isSelected,
  onClick,
}: {
  savedGift: ApiSavedStarGift;
  isSelected?: boolean;
  onClick: (savedGift: ApiSavedStarGift) => void;
}) => {
  const stickerRef = useRef<HTMLDivElement>();
  const { model, pattern, backdrop } = getGiftAttributes(savedGift.gift) || {};

  const backgroundColors = useMemo(() => (
    backdrop ? [backdrop.centerColor, backdrop.edgeColor] : undefined
  ), [backdrop]);

  return (
    <button
      type="button"
      className={buildClassName(styles.gift, isSelected && styles.giftSelected)}
      onClick={() => onClick(savedGift)}
    >
      {backgroundColors && (
        <RadialPatternBackground
          className={styles.giftBackground}
          backgroundColors={backgroundColors}
          patternIcon={pattern?.sticker}
          patternSize={GIFT_PATTERN_SIZE}
          ringsCount={1}
          ovalFactor={1}
        />
      )}
      {model && (
        <div ref={stickerRef} className={styles.giftSticker}>
          <StickerView containerRef={stickerRef} sticker={model.sticker} size={GIFT_STICKER_SIZE} />
        </div>
      )}
    </button>
  );
});

export default memo(QrCodeThemeEditor);

function getIsPremiumReaction(
  reaction: ApiReaction, presetIds: Set<string>, availableReactions?: ApiAvailableReaction[],
) {
  if (reaction.type === 'custom') return !presetIds.has(reaction.documentId);

  return Boolean(availableReactions?.find((available) => isSameReaction(available.reaction, reaction))?.isPremium);
}
