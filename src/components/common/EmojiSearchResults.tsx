import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, getGlobal } from '../../global';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { EMOJI_SIZE_PICKER } from '../../config';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import EmojiButton from '../middle/composer/EmojiButton';
import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import CollapsibleSection from './CollapsibleSection';
import CustomEmoji from './CustomEmoji';
import FoundPacksRow from './FoundPacksRow';
import StickerButton from './StickerButton';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './EmojiSearchResults.module.scss';

type OwnProps = {
  nativeResults?: Emoji[];
  customResults?: ApiSticker[];
  customResultIds?: string[];
  packSets?: ApiStickerSet[];
  globalResults?: ApiSticker[];
  withSections?: boolean;
  isCurrentUserPremium?: boolean;
  isSavedMessages?: boolean;
  isLocalSectionCollapsed?: boolean;
  isGlobalSectionCollapsed?: boolean;
  observeIntersection: ObserveFn;
  onEmojiSelect?: (emoji: string, name: string) => void;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
  onPackSelect?: (set: ApiStickerSet) => void;
  onLocalSectionToggle?: NoneToVoidFunction;
  onGlobalSectionToggle?: NoneToVoidFunction;
};

const FOUND_PACK_COVER_SIZE = 3 * REM;

const EmojiSearchResults = ({
  nativeResults,
  customResults,
  customResultIds,
  packSets,
  globalResults,
  withSections,
  isCurrentUserPremium,
  isSavedMessages,
  isLocalSectionCollapsed,
  isGlobalSectionCollapsed,
  observeIntersection,
  onEmojiSelect,
  onCustomEmojiSelect,
  onPackSelect,
  onLocalSectionToggle,
  onGlobalSectionToggle,
}: OwnProps) => {
  const oldLang = useOldLang();
  const lang = useLang();

  const handleGroupCustomEmojiClick = useLastCallback((documentId: string) => {
    const sticker = getGlobal().customEmojis.byId[documentId];
    if (!sticker) {
      return;
    }

    const isLocked = !isCurrentUserPremium && !isSavedMessages && !sticker.isFree;
    if (isLocked) {
      getActions().showNotification({
        message: { key: 'PremiumUnlockEmoji' },
        actionText: { key: 'PremiumMore' },
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
      });
      return;
    }

    onCustomEmojiSelect(sticker);
  });

  const handleGroupCustomEmojiKeyDown = useLastCallback((e: React.KeyboardEvent, documentId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleGroupCustomEmojiClick(documentId);
    }
  });

  const localIds = useMemo(() => new Set((customResults || []).map(({ id }) => id)), [customResults]);

  const serverResultIds = useMemo(() => {
    if (!customResultIds?.length) {
      return undefined;
    }

    return customResultIds.filter((id) => !localIds.has(id));
  }, [customResultIds, localIds]);

  const dedupedGlobalResults = useMemo(() => {
    if (!globalResults?.length) {
      return undefined;
    }

    return globalResults.filter(({ id }) => !localIds.has(id));
  }, [globalResults, localIds]);

  const hasLocalResults = Boolean(nativeResults?.length || customResults?.length || serverResultIds?.length);
  const hasResults = hasLocalResults || Boolean(packSets?.length || dedupedGlobalResults?.length);

  if (!hasResults) {
    return (
      <div className={styles.noResults}>{lang('NoEmojiFound')}</div>
    );
  }

  function renderCustomStickers(stickers: ApiSticker[]) {
    return stickers.map((sticker) => (
      <StickerButton
        key={sticker.id}
        sticker={sticker}
        size={EMOJI_SIZE_PICKER}
        observeIntersection={observeIntersection}
        onClick={onCustomEmojiSelect}
        clickArg={sticker}
        isSavedMessages={isSavedMessages}
        isCurrentUserPremium={isCurrentUserPremium}
      />
    ));
  }

  function renderLocalGrid() {
    return (
      <div
        className={buildClassName('symbol-set-container', 'shown', styles.grid)}
        dir={oldLang.isRtl ? 'rtl' : undefined}
      >
        {customResults && renderCustomStickers(customResults)}
        {onEmojiSelect && nativeResults?.map((emoji) => (
          <EmojiButton
            key={emoji.id}
            emoji={emoji}
            onClick={onEmojiSelect}
          />
        ))}
        {serverResultIds?.map((documentId) => (
          <div
            key={documentId}
            role="button"
            tabIndex={0}
            className={styles.customCell}
            onClick={() => handleGroupCustomEmojiClick(documentId)}
            onKeyDown={(e) => handleGroupCustomEmojiKeyDown(e, documentId)}
          >
            <CustomEmoji
              documentId={documentId}
              size={EMOJI_SIZE_PICKER}
              isBig
              noPlaceholder
              forceOnHeavyAnimation
              observeIntersectionForLoading={observeIntersection}
              observeIntersectionForPlaying={observeIntersection}
            />
          </div>
        ))}
      </div>
    );
  }

  function renderFoundPack(set: ApiStickerSet) {
    const firstSticker = set.covers?.[0] || set.stickers?.[0];

    return (
      <Button
        key={set.id}
        className={pickerStyles.foundPack}
        color="translucent"
        ariaLabel={set.title}

        onClick={() => onPackSelect?.(set)}
      >
        {set.hasThumbnail || !firstSticker ? (
          <StickerSetCover
            stickerSet={set}
            size={FOUND_PACK_COVER_SIZE}
            observeIntersection={observeIntersection}
            forcePlayback
          />
        ) : (
          <StickerButton
            sticker={firstSticker}
            size={FOUND_PACK_COVER_SIZE}
            className={pickerStyles.foundPackCover}
            observeIntersection={observeIntersection}
            noContextMenu
            isCurrentUserPremium
            clickArg={0}
            forcePlayback
          />
        )}
        <span className={pickerStyles.foundPackTitle}>{set.title}</span>
      </Button>
    );
  }

  if (!withSections) {
    return renderLocalGrid();
  }

  return (
    <div>
      {Boolean(packSets?.length) && (
        <FoundPacksRow>
          {packSets.map(renderFoundPack)}
        </FoundPacksRow>
      )}
      {hasLocalResults && (
        <CollapsibleSection
          className={pickerStyles.resultSection}
          title={lang('StickerSearchResult')}
          isCollapsed={Boolean(isLocalSectionCollapsed)}
          onToggle={onLocalSectionToggle!}
        >
          {renderLocalGrid()}
        </CollapsibleSection>
      )}
      {Boolean(dedupedGlobalResults?.length) && (
        <CollapsibleSection
          className={pickerStyles.resultSection}
          title={lang('StickerSearchGlobalResult')}
          isCollapsed={Boolean(isGlobalSectionCollapsed)}
          onToggle={onGlobalSectionToggle!}
        >
          <div
            className={buildClassName('symbol-set-container', 'shown', styles.grid)}
            dir={oldLang.isRtl ? 'rtl' : undefined}
          >
            {renderCustomStickers(dedupedGlobalResults)}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

export default memo(EmojiSearchResults);
