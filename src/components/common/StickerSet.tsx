import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiAvailableReaction, ApiEmojiStatusType, ApiReactionWithPaid, ApiSticker,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { StickerSetOrReactionsSetOrRecent } from '../../types';

import {
  COLLECTIBLE_STATUS_SET_ID,
  DEFAULT_STATUS_ICON_ID,
  DEFAULT_TOPIC_ICON_STICKER_ID,
  EFFECT_EMOJIS_SET_ID,
  EFFECT_STICKERS_SET_ID,
  EMOJI_SIZE_PICKER,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  STICKER_SIZE_PICKER,
} from '../../config';
import { getReactionKey } from '../../global/helpers';
import { selectIsAlwaysHighPriorityEmoji, selectIsSetPremium } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../hooks/useOldLang';
import useResizeObserver from '../../hooks/useResizeObserver';
import useWindowSize from '../../hooks/window/useWindowSize';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import Icon from './icons/Icon';
import ReactionEmoji from './reactions/ReactionEmoji';
import StickerButton from './StickerButton';

import grey from '../../assets/icons/forumTopic/grey.svg';

type OwnProps = {
  stickerSet: StickerSetOrReactionsSetOrRecent;
  loadAndPlay: boolean;
  index: number;
  idPrefix: string;
  isNearActive: boolean;
  favoriteStickers?: ApiSticker[];
  isSavedMessages?: boolean;
  isStatusPicker?: boolean;
  isReactionPicker?: boolean;
  isCurrentUserPremium?: boolean;
  shouldHideHeader?: boolean;
  selectedReactionIds?: string[];
  withDefaultTopicIcon?: boolean;
  withDefaultStatusIcon?: boolean;
  isChatEmojiSet?: boolean;
  isChatStickerSet?: boolean;
  isTranslucent?: boolean;
  noContextMenus?: boolean;
  forcePlayback?: boolean;
  observeIntersection?: ObserveFn;
  observeIntersectionForPlayingItems: ObserveFn;
  observeIntersectionForShowingItems: ObserveFn;
  availableReactions?: ApiAvailableReaction[];
  onStickerSelect?: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onReactionSelect?: (reaction: ApiReactionWithPaid) => void;
  onReactionContext?: (reaction: ApiReactionWithPaid) => void;
  onStickerUnfave?: (sticker: ApiSticker) => void;
  onStickerFave?: (sticker: ApiSticker) => void;
  onStickerRemoveRecent?: (sticker: ApiSticker) => void;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  collectibleStatuses?: ApiEmojiStatusType[];
};

const ITEMS_PER_ROW_FALLBACK = 8;
const ITEMS_MOBILE_PER_ROW_FALLBACK = 7;
const ITEMS_MINI_MOBILE_PER_ROW_FALLBACK = 6;
const MOBILE_WIDTH_THRESHOLD_PX = 440;
const MINI_MOBILE_WIDTH_THRESHOLD_PX = 362;

const StickerSet: FC<OwnProps & StateProps> = ({
  stickerSet,
  loadAndPlay,
  index,
  idPrefix,
  isNearActive,
  favoriteStickers,
  availableReactions,
  isSavedMessages,
  isStatusPicker,
  isReactionPicker,
  isCurrentUserPremium,
  shouldHideHeader,
  withDefaultTopicIcon,
  selectedReactionIds,
  withDefaultStatusIcon,
  isChatEmojiSet,
  isChatStickerSet,
  isTranslucent,
  noContextMenus,
  forcePlayback,
  observeIntersection,
  observeIntersectionForPlayingItems,
  observeIntersectionForShowingItems,
  onReactionSelect,
  onReactionContext,
  onStickerSelect,
  onStickerUnfave,
  onStickerFave,
  onStickerRemoveRecent,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
  collectibleStatuses,
}) => {
  const {
    clearRecentStickers,
    clearRecentCustomEmoji,
    clearRecentReactions,
    openPremiumModal,
    toggleStickerSet,
    loadStickers,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const lang = useOldLang();
  const { width: windowWidth } = useWindowSize();
  const [isConfirmModalOpen, openConfirmModal, closeConfirmModal] = useFlag();
  const { isMobile } = useAppLayout();

  const [itemsPerRow, setItemsPerRow] = useState(getItemsPerRowFallback(windowWidth));

  const isIntersecting = useIsIntersecting(ref, observeIntersection ?? observeIntersectionForShowingItems);
  const transitionClassNames = useMediaTransitionDeprecated(isIntersecting);

  // `isNearActive` is set in advance during animation, but it is not reliable for short sets
  const shouldRender = isNearActive || isIntersecting;

  const stickerMarginPx = isMobile ? 8 : 4;
  const emojiMarginPx = isMobile ? 8 : 10;
  const emojiVerticalMarginPx = isMobile ? 8 : 4;
  const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID;
  const isStatusCollectible = stickerSet.id === COLLECTIBLE_STATUS_SET_ID;
  const isFavorite = stickerSet.id === FAVORITE_SYMBOL_SET_ID;
  const isPopular = stickerSet.id === POPULAR_SYMBOL_SET_ID;
  const isEmoji = stickerSet.isEmoji;
  const isPremiumSet = !isRecent && selectIsSetPremium(stickerSet);

  const handleClearRecent = useLastCallback(() => {
    if (isReactionPicker) {
      clearRecentReactions();
    } else if (isEmoji) {
      clearRecentCustomEmoji();
    } else {
      clearRecentStickers();
    }
    closeConfirmModal();
  });

  const handleAddClick = useLastCallback(() => {
    if (isPremiumSet && !isCurrentUserPremium) {
      openPremiumModal({
        initialSection: 'animated_emoji',
      });
    } else {
      toggleStickerSet({
        stickerSetId: stickerSet.id,
      });
    }
  });

  const handleDefaultTopicIconClick = useLastCallback(() => {
    onStickerSelect?.({
      mediaType: 'sticker',
      id: DEFAULT_TOPIC_ICON_STICKER_ID,
      isLottie: false,
      isVideo: false,
      stickerSetInfo: {
        shortName: 'dummy',
      },
    } satisfies ApiSticker);
  });

  const handleDefaultStatusIconClick = useLastCallback(() => {
    onStickerSelect?.({
      mediaType: 'sticker',
      id: DEFAULT_STATUS_ICON_ID,
      isLottie: false,
      isVideo: false,
      stickerSetInfo: {
        shortName: 'dummy',
      },
    } satisfies ApiSticker);
  });

  const itemSize = isEmoji ? EMOJI_SIZE_PICKER : STICKER_SIZE_PICKER;
  const margin = isEmoji ? emojiMarginPx : stickerMarginPx;
  const verticalMargin = isEmoji ? emojiVerticalMarginPx : stickerMarginPx;

  const calculateItemsPerRow = useLastCallback((width: number) => {
    if (!width) {
      return getItemsPerRowFallback(windowWidth);
    }

    return Math.floor((width + margin) / (itemSize + margin));
  });

  const handleResize = useLastCallback((entry: ResizeObserverEntry) => {
    setItemsPerRow(calculateItemsPerRow(entry.contentRect.width));
  });

  useResizeObserver(ref, handleResize);

  useEffect(() => {
    if (!ref.current) return;
    setItemsPerRow(calculateItemsPerRow(ref.current.clientWidth));
  }, [calculateItemsPerRow]);

  useEffect(() => {
    if (shouldRender && !stickerSet.stickers?.length && !stickerSet.reactions?.length && stickerSet.accessHash) {
      loadStickers({
        stickerSetInfo: {
          id: stickerSet.id,
          accessHash: stickerSet.accessHash,
        },
      });
    }
  }, [shouldRender, loadStickers, stickerSet]);

  const isLocked = !isSavedMessages && !isCurrentUserPremium && isPremiumSet && !isChatEmojiSet;

  const isInstalled = stickerSet.installedDate && !stickerSet.isArchived;

  const canCut = !isInstalled && stickerSet.id !== RECENT_SYMBOL_SET_ID
    && stickerSet.id !== POPULAR_SYMBOL_SET_ID && stickerSet.id !== EFFECT_EMOJIS_SET_ID
    && stickerSet.id !== EFFECT_STICKERS_SET_ID && !isChatEmojiSet && !isChatStickerSet;

  const [isCut, , expand] = useFlag(canCut);
  const itemsBeforeCutout = itemsPerRow * 3 - 1;
  const totalItemsCount = (withDefaultTopicIcon || withDefaultStatusIcon) ? stickerSet.count + 1 : stickerSet.count;

  const itemHeight = itemSize + verticalMargin;
  const heightWhenCut = Math.ceil(Math.min(itemsBeforeCutout, totalItemsCount) / itemsPerRow)
    * itemHeight - verticalMargin;
  const height = isCut ? heightWhenCut : Math.ceil(totalItemsCount / itemsPerRow) * itemHeight - verticalMargin;

  const favoriteStickerIdsSet = useMemo(() => (
    favoriteStickers ? new Set(favoriteStickers.map(({ id }) => id)) : undefined
  ), [favoriteStickers]);
  const collectibleEmojiIdsSet = useMemo(() => (
    collectibleStatuses ? new Set(collectibleStatuses.map(({ documentId }) => documentId)) : undefined
  ), [collectibleStatuses]);
  const withAddSetButton = !shouldHideHeader && !isRecent && !isStatusCollectible
   && isEmoji && !isPopular && !isChatEmojiSet
    && (!isInstalled || (!isCurrentUserPremium && !isSavedMessages));
  const addSetButtonText = useMemo(() => {
    if (isLocked) {
      if (isInstalled) return lang('lng_emoji_premium_restore');
      return lang('Unlock');
    }

    return lang('Add');
  }, [isLocked, lang, isInstalled]);

  return (
    <div
      ref={ref}
      key={stickerSet.id}
      id={`${idPrefix}-${index}`}
      className={
        buildClassName('symbol-set', isLocked && 'symbol-set-locked')
      }
    >
      {!shouldHideHeader && (
        <div className="symbol-set-header">
          <p className={buildClassName('symbol-set-title', withAddSetButton && 'symbol-set-title-external')}>
            {isLocked && <Icon name="lock-badge" className="symbol-set-locked-icon" />}
            <span className="symbol-set-name">{stickerSet.title}</span>
            {(isChatEmojiSet || isChatStickerSet) && (
              <span className="symbol-set-chat">{lang(isChatEmojiSet ? 'GroupEmoji' : 'GroupStickers')}</span>
            )}
            {withAddSetButton && Boolean(stickerSet.stickers) && (
              <span className="symbol-set-amount">
                {lang(isEmoji ? 'EmojiCount' : 'Stickers', stickerSet.stickers.length, 'i')}
              </span>
            )}
          </p>
          {isRecent && (
            <Icon className="symbol-set-remove" name="close" onClick={openConfirmModal} />
          )}
          {withAddSetButton && (
            <Button
              className="symbol-set-add-button"
              withPremiumGradient={isPremiumSet && !isCurrentUserPremium}
              onClick={handleAddClick}
              pill
              size="tiny"
              fluid
            >
              {addSetButtonText}
            </Button>
          )}
        </div>
      )}
      <div
        className={buildClassName(
          'symbol-set-container shared-canvas-container',
          transitionClassNames,
          stickerSet.id === EFFECT_EMOJIS_SET_ID && 'effect-emojis',
        )}
        style={`height: ${height}px;`}
      >
        <canvas
          ref={sharedCanvasRef}
          className="shared-canvas"
          style={canCut ? `height: ${heightWhenCut}px;` : undefined}
        />
        {(isRecent || isFavorite || canCut) && <canvas ref={sharedCanvasHqRef} className="shared-canvas" />}
        {withDefaultTopicIcon && (
          <Button
            className="StickerButton custom-emoji"
            color="translucent"
            onClick={handleDefaultTopicIconClick}
            key="default-topic-icon"
          >
            <img src={grey} alt="Reset" className="sticker-media" draggable={false} />
          </Button>
        )}
        {withDefaultStatusIcon && (
          <Button
            className="StickerButton custom-emoji status-default"
            color="translucent"
            onClick={handleDefaultStatusIconClick}
            key="default-status-icon"
          >
            <Icon name="star" />
          </Button>
        )}
        {shouldRender && stickerSet.reactions?.map((reaction) => {
          const reactionId = getReactionKey(reaction);
          const isSelected = reactionId ? selectedReactionIds?.includes(reactionId) : undefined;

          return (
            <ReactionEmoji
              key={`${stickerSet.id}_${reactionId}`}
              reaction={reaction}
              isSelected={isSelected}
              loadAndPlay={loadAndPlay}
              availableReactions={availableReactions}
              observeIntersection={observeIntersectionForPlayingItems}
              onClick={onReactionSelect!}
              onContextMenu={onReactionContext}
              sharedCanvasRef={sharedCanvasRef}
              sharedCanvasHqRef={sharedCanvasHqRef}
              forcePlayback={forcePlayback}
            />
          );
        })}
        {shouldRender && stickerSet.stickers?.slice(0, isCut ? itemsBeforeCutout : stickerSet.stickers.length)
          .map((sticker, i) => {
            const isHqEmoji = (isRecent || isFavorite)
              && selectIsAlwaysHighPriorityEmoji(getGlobal(), sticker.stickerSetInfo);
            const canvasRef = (canCut && i >= itemsBeforeCutout) || isHqEmoji
              ? sharedCanvasHqRef
              : sharedCanvasRef;
            const reactionId = sticker.isCustomEmoji ? sticker.id : sticker.emoji;
            const isSelected = reactionId ? selectedReactionIds?.includes(reactionId) : undefined;

            const withSparkles = sticker.id === COLLECTIBLE_STATUS_SET_ID
            || collectibleEmojiIdsSet?.has(sticker.id);

            return (
              <StickerButton
                key={sticker.id}
                sticker={sticker}
                size={itemSize}
                observeIntersection={observeIntersectionForPlayingItems}
                observeIntersectionForShowing={observeIntersectionForShowingItems}
                noPlay={!loadAndPlay}
                isSavedMessages={isSavedMessages}
                isStatusPicker={isStatusPicker}
                canViewSet
                noContextMenu={noContextMenus}
                isCurrentUserPremium={isCurrentUserPremium}
                shouldIgnorePremium={isChatEmojiSet}
                sharedCanvasRef={canvasRef}
                withTranslucentThumb={isTranslucent}
                onClick={onStickerSelect}
                clickArg={sticker}
                isSelected={isSelected}
                onUnfaveClick={isFavorite && favoriteStickerIdsSet?.has(sticker.id) ? onStickerUnfave : undefined}
                onFaveClick={!favoriteStickerIdsSet?.has(sticker.id) ? onStickerFave : undefined}
                onRemoveRecentClick={isRecent ? onStickerRemoveRecent : undefined}
                onContextMenuOpen={onContextMenuOpen}
                onContextMenuClose={onContextMenuClose}
                onContextMenuClick={onContextMenuClick}
                forcePlayback={forcePlayback}
                isEffectEmoji={stickerSet.id === EFFECT_EMOJIS_SET_ID}
                noShowPremium={isCurrentUserPremium
                  && (stickerSet.id === EFFECT_STICKERS_SET_ID || stickerSet.id === EFFECT_EMOJIS_SET_ID)}
                withSparkles={withSparkles}
              />
            );
          })}
        {isCut && totalItemsCount > itemsBeforeCutout && (
          <Button
            className="StickerButton custom-emoji set-expand"
            round
            color="translucent"
            onClick={expand}
            key="more"
          >
            +{totalItemsCount - itemsBeforeCutout}
          </Button>
        )}
      </div>

      {isRecent && (
        <ConfirmDialog
          text={lang(isReactionPicker ? 'ClearRecentReactionsAlertMessage' : 'ClearRecentStickersAlertMessage')}
          isOpen={isConfirmModalOpen}
          onClose={closeConfirmModal}
          confirmHandler={handleClearRecent}
          confirmIsDestructive
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const collectibleStatuses = global.collectibleEmojiStatuses?.statuses;

    return { collectibleStatuses };
  },
)(StickerSet));

function getItemsPerRowFallback(windowWidth: number): number {
  return windowWidth > MOBILE_WIDTH_THRESHOLD_PX
    ? ITEMS_PER_ROW_FALLBACK
    : (windowWidth < MINI_MOBILE_WIDTH_THRESHOLD_PX
      ? ITEMS_MINI_MOBILE_PER_ROW_FALLBACK
      : ITEMS_MOBILE_PER_ROW_FALLBACK);
}
