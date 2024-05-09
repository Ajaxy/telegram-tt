import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../global';

import type {
  ApiAvailableReaction, ApiReaction, ApiSticker, ApiStickerSet,
} from '../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../types';

import {
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
  STICKER_PICKER_MAX_SHARED_COVERS,
  STICKER_SIZE_PICKER_HEADER,
  TOP_SYMBOL_SET_ID,
} from '../../config';
import { isSameReaction } from '../../global/helpers';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectIsAlwaysHighPriorityEmoji,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
} from '../../global/selectors';
import animateHorizontalScroll from '../../util/animateHorizontalScroll';
import buildClassName from '../../util/buildClassName';
import { pickTruthy, unique } from '../../util/iteratees';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useScrolledState from '../../hooks/useScrolledState';
import useAsyncRendering from '../right/hooks/useAsyncRendering';
import { useStickerPickerObservers } from './hooks/useStickerPickerObservers';

import StickerSetCover from '../middle/composer/StickerSetCover';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Icon from './Icon';
import StickerButton from './StickerButton';
import StickerSet from './StickerSet';

import pickerStyles from '../middle/composer/StickerPicker.module.scss';
import styles from './CustomEmojiPicker.module.scss';

type OwnProps = {
  chatId?: string;
  className?: string;
  pickerListClassName?: string;
  isHidden?: boolean;
  loadAndPlay: boolean;
  idPrefix?: string;
  withDefaultTopicIcons?: boolean;
  onCustomEmojiSelect: (sticker: ApiSticker) => void;
  onReactionSelect?: (reaction: ApiReaction) => void;
  selectedReactionIds?: string[];
  isStatusPicker?: boolean;
  isReactionPicker?: boolean;
  isTranslucent?: boolean;
  onContextMenuOpen?: NoneToVoidFunction;
  onContextMenuClose?: NoneToVoidFunction;
  onContextMenuClick?: NoneToVoidFunction;
};

type StateProps = {
  customEmojisById?: Record<string, ApiSticker>;
  recentCustomEmojiIds?: string[];
  recentStatusEmojis?: ApiSticker[];
  chatEmojiSetId?: string;
  topReactions?: ApiReaction[];
  recentReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  stickerSetsById: Record<string, ApiStickerSet>;
  availableReactions?: ApiAvailableReaction[];
  addedCustomEmojiIds?: string[];
  defaultTopicIconsId?: string;
  defaultStatusIconsId?: string;
  customEmojiFeaturedIds?: string[];
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const HEADER_BUTTON_WIDTH = 2.5 * REM; // px (including margin)

const DEFAULT_ID_PREFIX = 'custom-emoji-set';
const TOP_REACTIONS_COUNT = 16;
const RECENT_REACTIONS_COUNT = 32;
const FADED_BUTTON_SET_IDS = new Set([RECENT_SYMBOL_SET_ID, FAVORITE_SYMBOL_SET_ID, POPULAR_SYMBOL_SET_ID]);
const STICKER_SET_IDS_WITH_COVER = new Set([
  RECENT_SYMBOL_SET_ID,
  FAVORITE_SYMBOL_SET_ID,
  POPULAR_SYMBOL_SET_ID,
]);

const CustomEmojiPicker: FC<OwnProps & StateProps> = ({
  className,
  pickerListClassName,
  isHidden,
  loadAndPlay,
  addedCustomEmojiIds,
  customEmojisById,
  recentCustomEmojiIds,
  selectedReactionIds,
  recentStatusEmojis,
  stickerSetsById,
  chatEmojiSetId,
  topReactions,
  recentReactions,
  availableReactions,
  idPrefix = DEFAULT_ID_PREFIX,
  customEmojiFeaturedIds,
  canAnimate,
  isReactionPicker,
  isStatusPicker,
  isTranslucent,
  isSavedMessages,
  isCurrentUserPremium,
  withDefaultTopicIcons,
  defaultTopicIconsId,
  defaultStatusIconsId,
  defaultTagReactions,
  onCustomEmojiSelect,
  onReactionSelect,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasHqRef = useRef<HTMLCanvasElement>(null);

  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const recentCustomEmojis = useMemo(() => {
    return isStatusPicker
      ? recentStatusEmojis
      : Object.values(pickTruthy(customEmojisById!, recentCustomEmojiIds!));
  }, [customEmojisById, isStatusPicker, recentCustomEmojiIds, recentStatusEmojis]);

  const prefix = `${idPrefix}-custom-emoji`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const lang = useLang();

  const areAddedLoaded = Boolean(addedCustomEmojiIds);

  const allSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

    if (isReactionPicker && isSavedMessages) {
      if (defaultTagReactions?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: lang('PremiumPreviewTags'),
          reactions: defaultTagReactions,
          count: defaultTagReactions.length,
          isEmoji: true,
        });
      }
    }

    if (isReactionPicker && !isSavedMessages) {
      const topReactionsSlice = topReactions?.slice(0, TOP_REACTIONS_COUNT) || [];
      if (topReactionsSlice?.length) {
        defaultSets.push({
          id: TOP_SYMBOL_SET_ID,
          accessHash: '',
          title: lang('Reactions'),
          reactions: topReactionsSlice,
          count: topReactionsSlice.length,
          isEmoji: true,
        });
      }

      const cleanRecentReactions = (recentReactions || [])
        .filter((reaction) => !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction)))
        .slice(0, RECENT_REACTIONS_COUNT);
      const cleanAvailableReactions = (availableReactions || [])
        .map(({ reaction }) => reaction)
        .filter((reaction) => {
          return !topReactionsSlice.some((topReaction) => isSameReaction(topReaction, reaction))
            && !cleanRecentReactions.some((topReaction) => isSameReaction(topReaction, reaction));
        });
      if (cleanAvailableReactions?.length || cleanRecentReactions?.length) {
        const isPopular = !cleanRecentReactions?.length;
        const allRecentReactions = cleanRecentReactions.concat(cleanAvailableReactions);
        defaultSets.push({
          id: isPopular ? POPULAR_SYMBOL_SET_ID : RECENT_SYMBOL_SET_ID,
          accessHash: '',
          title: lang(isPopular ? 'PopularReactions' : 'RecentStickers'),
          reactions: allRecentReactions,
          count: allRecentReactions.length,
          isEmoji: true,
        });
      }
    } else if (isStatusPicker) {
      const defaultStatusIconsPack = stickerSetsById[defaultStatusIconsId!];
      if (defaultStatusIconsPack?.stickers?.length) {
        const stickers = (defaultStatusIconsPack.stickers || []).concat(recentCustomEmojis || []);
        defaultSets.push({
          ...defaultStatusIconsPack,
          stickers,
          count: stickers.length,
          id: RECENT_SYMBOL_SET_ID,
          title: lang('RecentStickers'),
        });
      }
    } else if (withDefaultTopicIcons) {
      const defaultTopicIconsPack = stickerSetsById[defaultTopicIconsId!];
      if (defaultTopicIconsPack.stickers?.length) {
        defaultSets.push({
          ...defaultTopicIconsPack,
          id: RECENT_SYMBOL_SET_ID,
          title: lang('RecentStickers'),
        });
      }
    } else if (recentCustomEmojis?.length) {
      defaultSets.push({
        id: RECENT_SYMBOL_SET_ID,
        accessHash: '0',
        title: lang('RecentStickers'),
        stickers: recentCustomEmojis,
        count: recentCustomEmojis.length,
        isEmoji: true,
      });
    }

    const userSetIds = [...(addedCustomEmojiIds || [])];
    if (chatEmojiSetId) {
      userSetIds.unshift(chatEmojiSetId);
    }

    const setIdsToDisplay = unique(userSetIds.concat(customEmojiFeaturedIds || []));

    const setsToDisplay = Object.values(pickTruthy(stickerSetsById, setIdsToDisplay));

    return [
      ...defaultSets,
      ...setsToDisplay,
    ];
  }, [
    addedCustomEmojiIds, isReactionPicker, isStatusPicker, withDefaultTopicIcons, recentCustomEmojis,
    customEmojiFeaturedIds, stickerSetsById, topReactions, availableReactions, lang, recentReactions,
    defaultStatusIconsId, defaultTopicIconsId, isSavedMessages, defaultTagReactions, chatEmojiSetId,
  ]);

  const noPopulatedSets = useMemo(() => (
    areAddedLoaded
    && allSets.filter((set) => set.stickers?.length).length === 0
  ), [allSets, areAddedLoaded]);

  const canRenderContent = useAsyncRendering([], SLIDE_TRANSITION_DURATION);
  const shouldRenderContent = areAddedLoaded && canRenderContent && !noPopulatedSets;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

  // Scroll container and header when active set changes
  useEffect(() => {
    if (!areAddedLoaded) {
      return;
    }

    const header = headerRef.current;
    if (!header) {
      return;
    }

    const newLeft = activeSetIndex * HEADER_BUTTON_WIDTH - (header.offsetWidth / 2 - HEADER_BUTTON_WIDTH / 2);

    animateHorizontalScroll(header, newLeft);
  }, [areAddedLoaded, activeSetIndex]);

  const handleEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    onCustomEmojiSelect(emoji);
  });

  const handleReactionSelect = useLastCallback((reaction: ApiReaction) => {
    onReactionSelect?.(reaction);
  });

  function renderCover(stickerSet: StickerSetOrReactionsSetOrRecent, index: number) {
    const firstSticker = stickerSet.stickers?.[0];
    const buttonClassName = buildClassName(
      pickerStyles.stickerCover,
      index === activeSetIndex && styles.activated,
    );

    const withSharedCanvas = index < STICKER_PICKER_MAX_SHARED_COVERS;
    const isHq = selectIsAlwaysHighPriorityEmoji(getGlobal(), stickerSet as ApiStickerSet);

    if (stickerSet.id === TOP_SYMBOL_SET_ID) {
      return undefined;
    }

    if (STICKER_SET_IDS_WITH_COVER.has(stickerSet.id) || stickerSet.hasThumbnail || !firstSticker) {
      const isRecent = stickerSet.id === RECENT_SYMBOL_SET_ID || stickerSet.id === POPULAR_SYMBOL_SET_ID;
      const isFaded = FADED_BUTTON_SET_IDS.has(stickerSet.id);
      return (
        <Button
          key={stickerSet.id}
          className={buttonClassName}
          ariaLabel={stickerSet.title}
          round
          faded={isFaded}
          color="translucent"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => selectStickerSet(isRecent ? 0 : index)}
        >
          {isRecent ? (
            <Icon name="recent" />
          ) : (
            <StickerSetCover
              stickerSet={stickerSet as ApiStickerSet}
              noPlay={!canAnimate || !loadAndPlay}
              forcePlayback
              observeIntersection={observeIntersectionForCovers}
              sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
            />
          )}
        </Button>
      );
    }

    return (
      <StickerButton
        key={stickerSet.id}
        sticker={firstSticker}
        size={STICKER_SIZE_PICKER_HEADER}
        title={stickerSet.title}
        className={buttonClassName}
        noPlay={!canAnimate || !loadAndPlay}
        observeIntersection={observeIntersectionForCovers}
        noContextMenu
        isCurrentUserPremium
        sharedCanvasRef={withSharedCanvas ? (isHq ? sharedCanvasHqRef : sharedCanvasRef) : undefined}
        withTranslucentThumb={isTranslucent}
        onClick={selectStickerSet}
        clickArg={index}
        forcePlayback
      />
    );
  }

  const fullClassName = buildClassName('StickerPicker', styles.root, className);

  if (!shouldRenderContent) {
    return (
      <div className={fullClassName}>
        {noPopulatedSets ? (
          <div className={pickerStyles.pickerDisabled}>{lang('NoStickers')}</div>
        ) : (
          <Loading />
        )}
      </div>
    );
  }

  const headerClassName = buildClassName(
    pickerStyles.header,
    'no-scrollbar',
    !shouldHideTopBorder && pickerStyles.headerWithBorder,
  );
  const listClassName = buildClassName(
    pickerStyles.main,
    pickerStyles.main_customEmoji,
    IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll',
    pickerListClassName,
  );

  return (
    <div className={fullClassName}>
      <div
        ref={headerRef}
        className={headerClassName}
      >
        <div className="shared-canvas-container">
          <canvas ref={sharedCanvasRef} className="shared-canvas" />
          <canvas ref={sharedCanvasHqRef} className="shared-canvas" />
          {allSets.map(renderCover)}
        </div>
      </div>
      <div
        ref={containerRef}
        onScroll={handleContentScroll}
        className={listClassName}
      >
        {allSets.map((stickerSet, i) => {
          const shouldHideHeader = stickerSet.id === TOP_SYMBOL_SET_ID
            || (stickerSet.id === RECENT_SYMBOL_SET_ID && (withDefaultTopicIcons || isStatusPicker));
          const isChatEmojiSet = stickerSet.id === chatEmojiSetId;

          return (
            <StickerSet
              key={stickerSet.id}
              stickerSet={stickerSet}
              loadAndPlay={Boolean(canAnimate && loadAndPlay)}
              index={i}
              idPrefix={prefix}
              observeIntersection={observeIntersectionForSet}
              observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
              observeIntersectionForShowingItems={observeIntersectionForShowingItems}
              isNearActive={activeSetIndex >= i - 1 && activeSetIndex <= i + 1}
              isSavedMessages={isSavedMessages}
              isStatusPicker={isStatusPicker}
              isReactionPicker={isReactionPicker}
              shouldHideHeader={shouldHideHeader}
              withDefaultTopicIcon={withDefaultTopicIcons && stickerSet.id === RECENT_SYMBOL_SET_ID}
              withDefaultStatusIcon={isStatusPicker && stickerSet.id === RECENT_SYMBOL_SET_ID}
              isChatEmojiSet={isChatEmojiSet}
              isCurrentUserPremium={isCurrentUserPremium}
              selectedReactionIds={selectedReactionIds}
              availableReactions={availableReactions}
              isTranslucent={isTranslucent}
              onReactionSelect={handleReactionSelect}
              onStickerSelect={handleEmojiSelect}
              onContextMenuOpen={onContextMenuOpen}
              onContextMenuClose={onContextMenuClose}
              onContextMenuClick={onContextMenuClick}
              forcePlayback
            />
          );
        })}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isStatusPicker, isReactionPicker }): StateProps => {
    const {
      stickers: {
        setsById: stickerSetsById,
      },
      customEmojis: {
        byId: customEmojisById,
        featuredIds: customEmojiFeaturedIds,
        statusRecent: {
          emojis: recentStatusEmojis,
        },
      },
      recentCustomEmojis: recentCustomEmojiIds,
      reactions: {
        availableReactions,
        recentReactions,
        topReactions,
        defaultTags,
      },
    } = global;

    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;

    return {
      customEmojisById: !isStatusPicker ? customEmojisById : undefined,
      recentCustomEmojiIds: !isStatusPicker ? recentCustomEmojiIds : undefined,
      recentStatusEmojis: isStatusPicker ? recentStatusEmojis : undefined,
      stickerSetsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      customEmojiFeaturedIds,
      defaultTopicIconsId: global.defaultTopicIconsId,
      defaultStatusIconsId: global.defaultStatusIconsId,
      topReactions: isReactionPicker ? topReactions : undefined,
      recentReactions: isReactionPicker ? recentReactions : undefined,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
      availableReactions: isReactionPicker ? availableReactions : undefined,
      defaultTagReactions: isReactionPicker ? defaultTags : undefined,
    };
  },
)(CustomEmojiPicker));
