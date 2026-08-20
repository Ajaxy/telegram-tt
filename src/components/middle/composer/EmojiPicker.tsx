import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiEmojiGroup, ApiSticker, ApiStickerSet } from '../../../api/types';
import type { StickerSetOrReactionsSetOrRecent } from '../../../types';
import type { IconName } from '../../../types/icons';
import type { EmojiData } from '../../../util/emoji/emoji';
import type { PillCategory } from './EmojiCategoryPill';

import {
  BASE_EMOJI_KEYWORD_LANG,
  EMOJI_SIZE_PICKER,
  MENU_TRANSITION_DURATION,
  RECENT_SYMBOL_SET_ID,
  SLIDE_TRANSITION_DURATION,
} from '../../../config';
import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import {
  selectCanPlayAnimatedEmojis,
  selectChatFullInfo,
  selectCustomEmojiForEmojis,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectIsSetPremium,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import animateHorizontalScroll from '../../../util/animateHorizontalScroll';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { ensureEmojiData } from '../../../util/emoji/emojiSearch';
import { pickTruthy, unique, uniqueByField } from '../../../util/iteratees';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import resetScroll from '../../../util/resetScroll';
import { REM } from '../../common/helpers/mediaDimensions';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useAppLayout from '../../../hooks/useAppLayout';
import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useScrolledState from '../../../hooks/useScrolledState';
import useSyncEffect from '../../../hooks/useSyncEffect';
import { useStickerPickerObservers } from '../../common/hooks/useStickerPickerObservers';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useEmojiSearch from './hooks/useEmojiSearch';

import EmojiSearchResults from '../../common/EmojiSearchResults';
import Icon from '../../common/icons/Icon';
import InlineStickerSetView, { StickerSetToggleButton } from '../../common/InlineStickerSetView';
import StickerButton from '../../common/StickerButton';
import StickerSet from '../../common/StickerSet';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition';
import EmojiCategory from './EmojiCategory';
import EmojiCategoryPill from './EmojiCategoryPill';
import EmojiSearch from './EmojiSearch';
import StickerSetCover from './StickerSetCover';

import './EmojiPicker.scss';

type OwnProps = {
  chatId?: string;
  className?: string;
  isHidden?: boolean;
  loadAndPlay?: boolean;
  idPrefix?: string;
  isTranslucent?: boolean;
  onEmojiSelect: (emoji: string, name: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
};

type StateProps = {
  recentEmojis: string[];
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  customEmojisById?: Record<string, ApiSticker>;
  recentCustomEmojiIds?: string[];
  stickerSetsById: Record<string, ApiStickerSet>;
  addedCustomEmojiIds?: string[];
  customEmojiFeaturedIds?: string[];
  chatEmojiSetId?: string;
  canAnimate?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  emojiGroups?: ApiEmojiGroup[];
};

type EmojiCategoryData = { id: string; name: string; emojis: string[] };

type EmojiSection =
  | { type: 'category'; category: EmojiCategoryData; title: string }
  | { type: 'set'; set: StickerSetOrReactionsSetOrRecent; isChatEmojiSet?: boolean };

const ICONS_BY_CATEGORY: Record<string, IconName> = {
  people: 'smile',
  nature: 'animals',
  foods: 'eats',
  activity: 'sport',
  places: 'car',
  objects: 'lamp',
  symbols: 'language',
  flags: 'flag',
};

const OPEN_ANIMATION_DELAY = 200;
const COVER_SIZE = 1.75 * REM;
const PILL_EXPANDED_WIDTH = 10 * REM;
const INTERSECTION_THROTTLE = 200;
const LOAD_MORE_THRESHOLD = 500;
const DEFAULT_ID_PREFIX = 'emoji-picker';

const EmojiPicker: FC<OwnProps & StateProps> = ({
  chatId,
  className,
  isHidden,
  loadAndPlay,
  idPrefix = DEFAULT_ID_PREFIX,
  isTranslucent,
  recentEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  customEmojisById,
  recentCustomEmojiIds,
  stickerSetsById,
  addedCustomEmojiIds,
  customEmojiFeaturedIds,
  chatEmojiSetId,
  canAnimate,
  isSavedMessages,
  isCurrentUserPremium,
  emojiGroups,
  onEmojiSelect,
  onCustomEmojiSelect,
}) => {
  const { loadStickers } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const headerRef = useRef<HTMLDivElement>();

  const [categories, setCategories] = useState<EmojiCategoryData[]>();
  const [emojis, setEmojis] = useState<EmojiData['emojis']>();
  const { isMobile } = useAppLayout();
  const {
    handleScroll: handleContentScroll,
    isAtBeginning: shouldHideTopBorder,
  } = useScrolledState();

  const {
    query,
    hasQuery,
    activeGroup,
    displayGroup,
    isSearchActive,
    nativeResults,
    customResults,
    customResultIds,
    queryResults,
    setQuery,
    selectGroup,
    searchMore,
    markSearchFocused,
    unmarkSearchFocused,
  } = useEmojiSearch({
    allEmojis: emojis,
    baseEmojiKeywords,
    emojiKeywords,
    noQueryCustomResults: true,
  });

  const trimmedQuery = query.trim().toLowerCase();

  const textResultsRef = useRef<{
    key: string;
    natives?: Emoji[];
    localCustom?: ApiSticker[];
    packSets?: ApiStickerSet[];
    globalStickers?: ApiSticker[];
  }>();
  const currentQueryResults = queryResults?.key === trimmedQuery ? queryResults : undefined;
  if (hasQuery && (nativeResults !== undefined || currentQueryResults)) {
    textResultsRef.current = {
      key: trimmedQuery,
      natives: nativeResults,
      localCustom: nativeResults
        ? uniqueByField(selectCustomEmojiForEmojis(getGlobal(), nativeResults.map(({ native }) => native)), 'id')
        : undefined,
      // Full sets loaded on demand (e.g. for covers) land in `stickerSetsById`, so prefer them over search snapshots
      packSets: currentQueryResults?.packSets?.map((set) => stickerSetsById[set.id] || set),
      globalStickers: currentQueryResults?.globalStickers,
    };
  }
  const textResults = hasQuery ? textResultsRef.current : undefined;
  const isShowingResults = displayGroup ? true : Boolean(textResults);
  const isSearchLoading = hasQuery && !currentQueryResults;

  const [openedPack, setOpenedPack] = useState<ApiStickerSet | undefined>();
  const [isLocalSectionCollapsed, setIsLocalSectionCollapsed] = useState(false);
  const [isGlobalSectionCollapsed, setIsGlobalSectionCollapsed] = useState(false);

  useSyncEffect(() => {
    setIsLocalSectionCollapsed(false);
    setIsGlobalSectionCollapsed(false);
  }, [trimmedQuery]);
  const openedSet = openedPack && (stickerSetsById[openedPack.id] || openedPack);

  const contentActiveKey = useTransitionActiveKey([
    isShowingResults, displayGroup?.title, textResults?.key, openedSet?.id,
  ]);

  const prefix = `${idPrefix}-emoji-section`;
  const {
    activeSetIndex,
    observeIntersectionForSet,
    observeIntersectionForPlayingItems,
    observeIntersectionForShowingItems,
    observeIntersectionForCovers,
    selectStickerSet: selectSection,
  } = useStickerPickerObservers(containerRef, headerRef, prefix, isHidden);

  const { observe: observeIntersectionForResults } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  useLayoutEffect(() => {
    if (containerRef.current) {
      resetScroll(containerRef.current, 0);
    }
  }, [isShowingResults, displayGroup, textResults?.key, openedSet?.id]);

  const canLoadAndPlay = usePrevDuringAnimation(loadAndPlay || undefined, SLIDE_TRANSITION_DURATION);

  const canRenderContents = useAsyncRendering([], MENU_TRANSITION_DURATION);
  const shouldRenderContent = emojis && canRenderContents;

  useHorizontalScroll(headerRef, isMobile || !shouldRenderContent);

  const oldLang = useOldLang();

  const customSets = useMemo(() => {
    const defaultSets: StickerSetOrReactionsSetOrRecent[] = [];

    if (isCurrentUserPremium || isSavedMessages) {
      const recentCustomEmojis = customEmojisById && recentCustomEmojiIds
        ? Object.values(pickTruthy(customEmojisById, recentCustomEmojiIds))
        : undefined;
      if (recentCustomEmojis?.length) {
        defaultSets.push({
          id: RECENT_SYMBOL_SET_ID,
          accessHash: '0',
          title: oldLang('RecentStickers'),
          stickers: recentCustomEmojis,
          count: recentCustomEmojis.length,
          isEmoji: true,
        });
      }
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
    isCurrentUserPremium, isSavedMessages, customEmojisById, recentCustomEmojiIds, addedCustomEmojiIds,
    chatEmojiSetId, customEmojiFeaturedIds, stickerSetsById, oldLang,
  ]);

  const sections = useMemo((): EmojiSection[] => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }

    const list: EmojiSection[] = [];

    if (recentEmojis?.length) {
      list.push({
        type: 'category',
        category: { id: RECENT_SYMBOL_SET_ID, name: oldLang('RecentStickers'), emojis: recentEmojis },
        title: oldLang('RecentStickers'),
      });
    }

    categories.forEach((category, index) => {
      list.push({ type: 'category', category, title: oldLang(`Emoji${index + 1}`) });
    });

    customSets.forEach((set) => {
      list.push({ type: 'set', set, isChatEmojiSet: set.id === chatEmojiSetId });
    });

    return list;
  }, [categories, recentEmojis, customSets, chatEmojiSetId, oldLang]);

  const firstCategoryIndex = recentEmojis?.length ? 1 : 0;
  const lastCategoryIndex = firstCategoryIndex + (categories?.length || 0) - 1;
  const isPillActive = Boolean(categories)
    && activeSetIndex >= firstCategoryIndex && activeSetIndex <= lastCategoryIndex;

  const pillCategories = useMemo((): PillCategory[] => {
    if (!categories) {
      return MEMO_EMPTY_ARRAY;
    }

    return categories.map(({ id, name }) => ({ id, name, icon: ICONS_BY_CATEGORY[id] || 'smile' }));
  }, [categories]);

  useEffect(() => {
    if (!shouldRenderContent) {
      return;
    }

    const activeSection = sections[activeSetIndex];
    if (activeSection?.type === 'set' && activeSection.set.id === RECENT_SYMBOL_SET_ID) {
      return;
    }

    requestMeasure(() => {
      const header = headerRef.current;
      if (!header) {
        return;
      }

      const target = isPillActive
        ? header.querySelector<HTMLElement>('.EmojiPicker-header-pill')
        : header.querySelector<HTMLElement>('.symbol-set-button.activated');
      if (!target) {
        return;
      }

      const headerRect = header.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetWidth = isPillActive ? PILL_EXPANDED_WIDTH : targetRect.width;
      const targetLeftInContent = targetRect.left - headerRect.left + header.scrollLeft;
      const newLeft = targetLeftInContent - (headerRect.width - targetWidth) / 2;
      animateHorizontalScroll(header, newLeft);
    });
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [activeSetIndex, isPillActive, shouldRenderContent]);

  // Initialize data on first render.
  useEffect(() => {
    const timeout = setTimeout(() => {
      void ensureEmojiData().then((data) => {
        setCategories(data.categories);
        setEmojis(data.emojis);
      });
    }, OPEN_ANIMATION_DELAY);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    onEmojiSelect(emoji, name);
  });

  const handleCustomEmojiSelect = useLastCallback((sticker: ApiSticker) => {
    onCustomEmojiSelect(sticker);
  });

  const handlePillCategorySelect = useLastCallback((index: number) => {
    selectSection(firstCategoryIndex + index);
  });

  const handleRecentSelect = useLastCallback(() => {
    selectSection(0);
  });

  const handlePackSelect = useLastCallback((set: ApiStickerSet) => {
    setOpenedPack(set);

    if (!stickerSetsById[set.id] || !set.stickers || set.stickers.length < set.count) {
      loadStickers({ stickerSetInfo: { id: set.id, accessHash: set.accessHash } });
    }
  });

  const handlePackBackClick = useLastCallback(() => {
    setOpenedPack(undefined);
  });

  const handleLocalSectionToggle = useLastCallback(() => {
    setIsLocalSectionCollapsed(!isLocalSectionCollapsed);
  });

  const handleGlobalSectionToggle = useLastCallback(() => {
    setIsGlobalSectionCollapsed(!isGlobalSectionCollapsed);
  });

  const handleQueryChange = useLastCallback((value: string) => {
    setOpenedPack(undefined);
    setQuery(value);
  });

  const handleGroupSelect = useLastCallback((group?: ApiEmojiGroup) => {
    setOpenedPack(undefined);
    selectGroup(group);
  });

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    handleContentScroll(e);

    if (!textResults || openedSet || isGlobalSectionCollapsed) {
      return;
    }

    const container = e.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < LOAD_MORE_THRESHOLD) {
      searchMore();
    }
  });

  function renderCover(section: EmojiSection, index: number) {
    if (section.type !== 'set' || section.set.id === RECENT_SYMBOL_SET_ID) {
      return undefined;
    }

    const { set } = section;
    const firstSticker = set.stickers?.[0];
    const buttonClassName = buildClassName(
      'symbol-set-button',
      'EmojiPicker-header-cover',
      index === activeSetIndex && 'activated',
    );

    const isLockedSet = !isCurrentUserPremium && !isSavedMessages && !section.isChatEmojiSet
      && selectIsSetPremium(set);
    const lockBadge = isLockedSet && <Icon name="lock" className="EmojiPicker-cover-lock" />;

    return (
      <Button
        key={set.id}
        className={buttonClassName}
        ariaLabel={set.title}
        round
        color="translucent"

        onClick={() => selectSection(index)}
      >
        {set.hasThumbnail || !firstSticker ? (
          <StickerSetCover
            stickerSet={set as ApiStickerSet}
            size={COVER_SIZE}
            noPlay={!canAnimate || !canLoadAndPlay}
            forcePlayback
            observeIntersection={observeIntersectionForCovers}
          />
        ) : (
          <StickerButton
            sticker={firstSticker}
            size={COVER_SIZE}
            title={set.title}
            className="EmojiPicker-cover-icon"
            noPlay={!canAnimate || !canLoadAndPlay}
            observeIntersection={observeIntersectionForCovers}
            noContextMenu
            isCurrentUserPremium
            withTranslucentThumb={isTranslucent}
            clickArg={index}
            forcePlayback
          />
        )}
        {lockBadge}
      </Button>
    );
  }

  function renderBrowseContent() {
    return (
      <div>
        {sections.map((section, index) => {
          if (section.type === 'category') {
            return (
              <EmojiCategory
                key={`category-${section.category.id}`}
                category={section.category}
                sectionId={`${prefix}-${index}`}
                title={section.title}
                allEmojis={emojis!}
                observeIntersection={observeIntersectionForSet}
                shouldRender={activeSetIndex >= index - 1 && activeSetIndex <= index + 1}
                onEmojiSelect={handleEmojiSelect}
              />
            );
          }

          return (
            <StickerSet
              key={section.set.id}
              stickerSet={section.set}
              loadAndPlay={Boolean(canAnimate && canLoadAndPlay)}
              index={index}
              idPrefix={prefix}
              observeIntersection={observeIntersectionForSet}
              observeIntersectionForPlayingItems={observeIntersectionForPlayingItems}
              observeIntersectionForShowingItems={observeIntersectionForShowingItems}
              isNearActive={activeSetIndex >= index - 1 && activeSetIndex <= index + 1}
              isSavedMessages={isSavedMessages}
              isChatEmojiSet={section.isChatEmojiSet}
              isCurrentUserPremium={isCurrentUserPremium}
              isTranslucent={isTranslucent}
              onStickerSelect={handleCustomEmojiSelect}
              forcePlayback
            />
          );
        })}
      </div>
    );
  }

  function renderOpenedPack() {
    return (
      <InlineStickerSetView
        stickerSet={openedSet!}
        stickerSize={EMOJI_SIZE_PICKER}
        observeIntersection={observeIntersectionForResults}
        noPlay={!canAnimate || !canLoadAndPlay}
        isSavedMessages={isSavedMessages}
        isCurrentUserPremium={isCurrentUserPremium}
        isTranslucent={isTranslucent}
        onStickerSelect={handleCustomEmojiSelect}
      />
    );
  }

  function renderSearchResults() {
    if (displayGroup) {
      return (
        <div>
          <EmojiSearchResults
            nativeResults={nativeResults}
            customResults={customResults}
            customResultIds={customResultIds}
            isCurrentUserPremium={isCurrentUserPremium}
            isSavedMessages={isSavedMessages}
            observeIntersection={observeIntersectionForResults}
            onEmojiSelect={handleEmojiSelect}
            onCustomEmojiSelect={handleCustomEmojiSelect}
          />
        </div>
      );
    }

    return (
      <div>
        <EmojiSearchResults
          nativeResults={textResults!.natives}
          customResults={textResults!.localCustom}
          packSets={textResults!.packSets}
          globalResults={textResults!.globalStickers}
          withSections
          isCurrentUserPremium={isCurrentUserPremium}
          isSavedMessages={isSavedMessages}
          isLocalSectionCollapsed={isLocalSectionCollapsed}
          isGlobalSectionCollapsed={isGlobalSectionCollapsed}
          observeIntersection={observeIntersectionForResults}
          onEmojiSelect={handleEmojiSelect}
          onCustomEmojiSelect={handleCustomEmojiSelect}
          onPackSelect={handlePackSelect}
          onLocalSectionToggle={handleLocalSectionToggle}
          onGlobalSectionToggle={handleGlobalSectionToggle}
        />
      </div>
    );
  }

  const containerClassName = buildClassName('EmojiPicker', className);
  const headerClassName = buildClassName(
    'EmojiPicker-header',
    'no-scrollbar',
    !shouldHideTopBorder && 'with-top-border',
  );

  return (
    <Transition className={containerClassName} activeKey={shouldRenderContent ? 1 : 0} name="fade" shouldCleanup>
      {!shouldRenderContent ? (
        <Loading />
      ) : (
        <div className={buildClassName('EmojiPicker-inner', isSearchActive && 'is-search-active')}>
          <div
            ref={headerRef}
            className={headerClassName}
            dir={oldLang.isRtl ? 'rtl' : undefined}
          >
            <div className="EmojiPicker-header-items">
              {Boolean(recentEmojis?.length) && (
                <Button
                  className={buildClassName(
                    'symbol-set-button',
                    'EmojiPicker-header-recent',
                    activeSetIndex === 0 && 'activated')}
                  round
                  faded
                  color="translucent"
                  onClick={handleRecentSelect}
                  ariaLabel={oldLang('RecentStickers')}
                  iconName="recent"
                />
              )}
              <EmojiCategoryPill
                categories={pillCategories}
                className="EmojiPicker-header-pill"
                activeCategoryIndex={isPillActive ? activeSetIndex - firstCategoryIndex : undefined}
                isActive={isPillActive}
                onCategorySelect={handlePillCategorySelect}
              />
              {sections.map(renderCover)}
            </div>
          </div>
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className={buildClassName('EmojiPicker-main', IS_TOUCH_ENV ? 'no-scrollbar' : 'custom-scroll')}
          >
            <EmojiSearch
              value={query}
              groups={emojiGroups}
              activeGroup={activeGroup}
              isLoading={isSearchLoading}
              hasBackButton={Boolean(openedSet)}
              onChange={handleQueryChange}
              onGroupSelect={handleGroupSelect}
              onBackClick={handlePackBackClick}
              onFocus={markSearchFocused}
              onBlur={unmarkSearchFocused}
            />
            <Transition
              name="zoomFade"
              activeKey={contentActiveKey}
              className="EmojiPicker-content-transition"
            >
              {openedSet ? renderOpenedPack() : isShowingResults ? renderSearchResults() : renderBrowseContent()}
            </Transition>
          </div>
          {openedSet && <StickerSetToggleButton stickerSet={openedSet} />}
        </div>
      )}
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const { language } = selectSharedSettings(global);
    const baseEmojiKeywords = global.emojiKeywords[BASE_EMOJI_KEYWORD_LANG];
    const emojiKeywords = language !== BASE_EMOJI_KEYWORD_LANG ? global.emojiKeywords[language] : undefined;
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const isSavedMessages = Boolean(chatId && selectIsChatWithSelf(global, chatId));

    return {
      recentEmojis: global.recentEmojis,
      baseEmojiKeywords: baseEmojiKeywords?.keywords,
      emojiKeywords: emojiKeywords?.keywords,
      customEmojisById: global.customEmojis.byId,
      recentCustomEmojiIds: global.recentCustomEmojis,
      stickerSetsById: global.stickers.setsById,
      addedCustomEmojiIds: global.customEmojis.added.setIds,
      customEmojiFeaturedIds: global.customEmojis.featuredIds,
      chatEmojiSetId: chatFullInfo?.emojiSet?.id,
      canAnimate: selectCanPlayAnimatedEmojis(global),
      isSavedMessages,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      emojiGroups: global.emojiGroups.groups,
    };
  },
)(EmojiPicker));
