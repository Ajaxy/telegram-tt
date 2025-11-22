import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect,
  useMemo,
  useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiChat, ApiMessage, ApiReaction, ApiReactionKey, ApiSavedReactionTag,
} from '../../../api/types';
import type {
  CustomPeer, MiddleSearchParams, MiddleSearchType, ThreadId,
} from '../../../types';

import { ANONYMOUS_USER_ID } from '../../../config';
import { requestMeasure, requestMutation, requestNextMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getIsSavedDialog, getReactionKey, isSameReaction, isSystemBot,
} from '../../../global/helpers';
import {
  selectChat,
  selectChatMessage,
  selectCurrentMessageList,
  selectCurrentMiddleSearch,
  selectForwardedSender,
  selectIsChatWithSelf,
  selectIsCurrentUserPremium,
  selectMonoforumChannel,
  selectSender,
  selectTabState,
} from '../../../global/selectors';
import { IS_IOS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { getDayStartAt } from '../../../util/dates/dateFormat';
import focusEditableElement from '../../../util/focusEditableElement';
import focusNoScroll from '../../../util/focusNoScroll';
import { getSearchResultKey, parseSearchResultKey, type SearchResultKey } from '../../../util/keys/searchResultKey';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { debounce, fastRaf } from '../../../util/schedulers';

import { useClickOutside } from '../../../hooks/events/useOutsideClick';
import useAppLayout from '../../../hooks/useAppLayout';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import SearchInput from '../../ui/SearchInput';
import SavedTagButton from '../message/reactions/SavedTagButton';
import MiddleSearchResult from './MiddleSearchResult';

import styles from './MiddleSearch.module.scss';

export type OwnProps = {
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  monoforumChat?: ApiChat;
  threadId?: ThreadId;
  requestedQuery?: string;
  savedTags?: Record<ApiReactionKey, ApiSavedReactionTag>;
  savedTag?: ApiReaction;
  totalCount?: number;
  lastSearchQuery?: string;
  foundIds?: SearchResultKey[];
  isHistoryCalendarOpen?: boolean;
  isCurrentUserPremium?: boolean;
  isSavedMessages?: boolean;
  fetchingQuery?: string;
  isHashtagQuery?: boolean;
  searchType?: MiddleSearchType;
  currentUserId?: string;
};

const CHANNELS_PEER: CustomPeer = {
  isCustomPeer: true,
  avatarIcon: 'channel-filled',
  titleKey: 'SearchPublicPosts',
};
const FOCUSED_SEARCH_TRIGGER_OFFSET = 5;
const HIDE_TIMEOUT = 200;
const RESULT_ITEM_CLASS_NAME = 'MiddleSearchResult';

const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const MiddleSearch: FC<OwnProps & StateProps> = ({
  isActive,
  chat,
  monoforumChat,
  threadId,
  requestedQuery,
  savedTags,
  savedTag,
  totalCount,
  lastSearchQuery,
  foundIds,
  isHistoryCalendarOpen,
  isCurrentUserPremium,
  isSavedMessages,
  fetchingQuery,
  isHashtagQuery,
  searchType = 'chat',
  currentUserId,
}) => {
  const {
    updateMiddleSearch,
    resetMiddleSearch,
    performMiddleSearch,
    focusMessage,
    closeMiddleSearch,
    openHistoryCalendar,
    openPremiumModal,
    loadSavedReactionTags,
  } = getActions();

  const ref = useRef<HTMLDivElement>();
  const inputRef = useRef<HTMLInputElement>();
  const containerRef = useRef<HTMLDivElement>();
  const shouldCancelSearchRef = useRef(false);

  const { isMobile } = useAppLayout();
  const oldLang = useOldLang();
  const lang = useLang();

  const [query, setQuery] = useState(requestedQuery || '');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const canFocusNewer = foundIds && focusedIndex > 0;
  const canFocusOlder = foundIds && focusedIndex < foundIds.length - 1;

  const [isFullyHidden, setIsFullyHidden] = useState(!isActive);
  const hiddenTimerRef = useRef<number>();
  const maybeLongPressActiveRef = useRef(true);

  const [isFocused, markFocused, markBlurred] = useFlag();
  const [isViewAsList, setIsViewAsList] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleClickOutside = useLastCallback((event: MouseEvent) => {
    if (maybeLongPressActiveRef.current) return;
    // Ignore clicks inside modals
    if ((event.target as HTMLElement).closest('.Modal')) return;
    markBlurred();
  });
  useClickOutside([ref], handleClickOutside);

  const hasResultsContainer = Boolean((query && foundIds) || isHashtagQuery);
  const isOnlyHash = isHashtagQuery && !query;
  const areResultsEmpty = Boolean(query && foundIds && !foundIds.length && !isLoading && !isOnlyHash);
  const hasResultsPlaceholder = areResultsEmpty || isOnlyHash;
  const isNonFocusedDropdownForced = searchType === 'myChats' || searchType === 'channels';
  const hasResultsDropdown = isActive && (isViewAsList || !isMobile) && (isFocused || isNonFocusedDropdownForced)
    && Boolean(
      hasResultsContainer || hasResultsPlaceholder || savedTags,
    );

  const hasQueryData = Boolean((query && !isOnlyHash) || savedTag);
  const hasNavigationButtons = searchType === 'chat' && Boolean(foundIds?.length);

  const handleClose = useLastCallback(() => {
    closeMiddleSearch();
  });

  const focusInput = useLastCallback(() => {
    requestMeasure(() => {
      focusNoScroll(inputRef.current);
    });
  });

  const blurInput = useLastCallback(() => {
    inputRef.current?.blur();
  });

  // Fix for iOS keyboard
  useEffect(() => {
    const { visualViewport } = window;
    if (!visualViewport) {
      return undefined;
    }

    const mainEl = document.getElementById('Main') as HTMLDivElement;
    const handleResize = () => {
      const { activeElement } = document;
      if (activeElement && (activeElement === inputRef.current)) {
        const { pageTop, height } = visualViewport;

        requestMutation(() => {
          mainEl.style.transform = `translateY(${pageTop}px)`;
          mainEl.style.height = `${height}px`;
          document.documentElement.scrollTop = pageTop;
        });
      } else {
        requestMutation(() => {
          mainEl.style.transform = '';
          mainEl.style.height = '';
        });
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  // Reset focus on query result
  useEffect(() => {
    setFocusedIndex(-1);
  }, [lastSearchQuery]);

  // Disable native up/down buttons on iOS
  useLayoutEffect(() => {
    if (!IS_IOS) return;

    Array.from(document.querySelectorAll<HTMLInputElement>('input')).forEach((input) => {
      input.disabled = Boolean(isActive && input !== inputRef.current);
    });
  }, [isActive]);

  // Blur on exit
  useEffect(() => {
    if (!isActive) {
      inputRef.current!.blur();
      setIsViewAsList(true);
      setFocusedIndex(0);
      setQuery('');
      hiddenTimerRef.current = window.setTimeout(() => setIsFullyHidden(true), HIDE_TIMEOUT);
    } else {
      setIsFullyHidden(false);
      clearTimeout(hiddenTimerRef.current);
    }
  }, [isActive]);

  useEffect(() => {
    if (!requestedQuery || !chat?.id) return;
    setQuery(requestedQuery);
    updateMiddleSearch({ chatId: chat.id, threadId, update: { requestedQuery: undefined } });
    setIsLoading(true);

    requestNextMutation(() => {
      const input = inputRef.current;
      if (!input) return;
      focusEditableElement(input, true, true);
      markFocused();
    });
  }, [chat?.id, requestedQuery, threadId]);

  useEffectWithPrevDeps(([prevIsActive]) => {
    if (isActive !== prevIsActive && !query && lastSearchQuery) {
      setQuery(lastSearchQuery); // Restore query when returning back
    }
  }, [isActive, lastSearchQuery, query]);

  useEffectWithPrevDeps(([prevIsCalendarOpen]) => {
    if (!isActive || prevIsCalendarOpen === isHistoryCalendarOpen) return;
    if (isHistoryCalendarOpen) {
      blurInput();
      markBlurred();
    } else {
      focusInput();
    }
  }, [isHistoryCalendarOpen, isActive]);

  const handleReset = useLastCallback(() => {
    if (!query?.length && !savedTag) {
      handleClose();
      return;
    }

    setQuery('');
    setIsLoading(false);
    resetMiddleSearch();
    focusInput();
  });

  useEffect(() => (isActive ? captureEscKeyListener(handleReset) : undefined), [isActive, handleClose]);

  const savedTagsArray = useMemo(() => {
    if (!savedTags) return undefined;
    return Object.values(savedTags);
  }, [savedTags]);

  const hasSavedTags = Boolean(savedTagsArray?.length);
  const areSavedTagsDisabled = hasSavedTags && !isCurrentUserPremium;

  useEffect(() => {
    if (isSavedMessages && isActive) loadSavedReactionTags();
  }, [isSavedMessages, isActive]);

  const handleSearch = useLastCallback(() => {
    const chatId = chat?.id;
    if (!chatId) {
      return;
    }

    runDebouncedForSearch(() => {
      if (shouldCancelSearchRef.current) return;
      performMiddleSearch({ chatId, threadId, query });
    });
  });

  const handleQueryChange = useLastCallback((newQuery: string) => {
    shouldCancelSearchRef.current = false;

    if (newQuery.startsWith('#') && !isHashtagQuery) {
      updateMiddleSearch({ chatId: chat!.id, threadId, update: { isHashtag: true } });
      setQuery(newQuery.slice(1));
      handleSearch();
      return;
    }

    setQuery(newQuery);

    if (!newQuery) {
      setIsLoading(false);
      resetMiddleSearch();
      shouldCancelSearchRef.current = true;
    }
  });

  useEffect(() => {
    if (query) {
      handleSearch();
    }
  }, [query]);

  useEffect(() => {
    setIsLoading(Boolean(fetchingQuery));
  }, [fetchingQuery]);

  useEffect(() => {
    if (!foundIds?.length) return;
    const isClose = foundIds.length - focusedIndex < FOCUSED_SEARCH_TRIGGER_OFFSET;
    if (isClose) {
      handleSearch();
    }
  }, [focusedIndex, foundIds?.length]);

  useEffect(() => {
    if (!isActive) return undefined;

    maybeLongPressActiveRef.current = true;

    function focus() {
      inputRef.current?.focus();
      markFocused();

      fastRaf(() => {
        maybeLongPressActiveRef.current = false;
      });
    }

    function removeListeners() {
      window.removeEventListener('touchend', focus);
      window.removeEventListener('mouseup', focus);

      fastRaf(() => {
        maybeLongPressActiveRef.current = false;
      });
    }

    window.addEventListener('touchend', focus);
    window.addEventListener('mouseup', focus);

    window.addEventListener('touchstart', removeListeners);
    window.addEventListener('mousedown', removeListeners);

    return () => {
      removeListeners();
      window.removeEventListener('touchstart', removeListeners);
      window.removeEventListener('mousedown', removeListeners);
    };
  }, [isActive]);

  useHistoryBack({
    isActive,
    onBack: handleClose,
  });

  const [viewportIds, getMore, viewportOffset = 0] = useInfiniteScroll(handleSearch, foundIds);

  const viewportResults = useMemo(() => {
    if ((!query && !savedTag) || !viewportIds?.length) {
      return MEMO_EMPTY_ARRAY;
    }
    const global = getGlobal();

    return viewportIds.map((searchResultKey) => {
      const [chatId, id] = parseSearchResultKey(searchResultKey);
      const message = selectChatMessage(global, chatId, id);
      if (!message) {
        return undefined;
      }

      const originalSender = (isSavedMessages || isSystemBot(chatId) || chatId === ANONYMOUS_USER_ID)
        ? selectForwardedSender(global, message) : undefined;
      const messageSender = selectSender(global, message);
      const messageChat = selectChat(global, message.chatId);

      const senderPeer = originalSender || messageSender;

      return {
        searchResultKey,
        message,
        messageChat,
        senderPeer,
      };
    }).filter(Boolean);
  }, [query, savedTag, viewportIds, isSavedMessages]);

  const handleMessageClick = useLastCallback((message: ApiMessage) => {
    const searchResultKey = getSearchResultKey(message);
    const index = foundIds?.indexOf(searchResultKey) || 0;
    const realIndex = index + viewportOffset;
    setFocusedIndex(realIndex);

    if (searchType === 'chat') {
      setIsViewAsList(false);
    }

    focusMessage({
      chatId: message.chatId,
      messageId: message.id,
      threadId: !isHashtagQuery ? threadId : undefined,
    });

    markBlurred();
  });

  const handleTriggerViewStyle = useLastCallback(() => {
    setIsViewAsList((prev) => !prev);
    markFocused();
  });

  const handleKeyDown = useKeyboardListNavigation(containerRef, hasResultsContainer, (index) => {
    const foundResult = viewportResults?.[index === -1 ? 0 : index];
    if (foundResult) {
      handleMessageClick(foundResult.message);
      setFocusedIndex(index + viewportOffset);
    }
  }, `.${RESULT_ITEM_CLASS_NAME}`, true);

  const updateSearchParams = useLastCallback((update: Partial<MiddleSearchParams>) => {
    updateMiddleSearch({ chatId: chat!.id, threadId, update });

    handleSearch();
  });

  const activateSearchTag = useLastCallback((tag: ApiReaction) => {
    if (areSavedTagsDisabled) {
      openPremiumModal({
        initialSection: 'saved_tags',
      });
      return;
    }

    updateSearchParams({ savedTag: tag });
  });

  const removeSearchSavedTag = useLastCallback(() => {
    updateSearchParams({ savedTag: undefined });
  });

  const handleDeleteTag = useLastCallback(() => {
    if (isHashtagQuery) {
      updateSearchParams({ isHashtag: false });
      return;
    }

    if (savedTag) {
      removeSearchSavedTag();
    }
  });

  const handleChangeSearchType = useLastCallback((type: MiddleSearchType) => {
    updateSearchParams({ type });
    setIsViewAsList(true);
  });

  const handleFocusOlder = useLastCallback(() => {
    if (searchType !== 'chat') return;
    markBlurred();
    blurInput();
    if (foundIds) {
      const newFocusIndex = focusedIndex + 1;
      const [chatId, messageId] = parseSearchResultKey(foundIds[newFocusIndex]);
      focusMessage({ chatId, messageId, threadId });
      setFocusedIndex(newFocusIndex);
    }
  });

  const handleFocusNewer = useLastCallback(() => {
    if (searchType !== 'chat') return;
    markBlurred();
    blurInput();
    if (foundIds) {
      const newFocusIndex = focusedIndex - 1;
      const [chatId, messageId] = parseSearchResultKey(foundIds[newFocusIndex]);
      focusMessage({ chatId, messageId, threadId });
      setFocusedIndex(newFocusIndex);
    }
  });

  function renderTypeTag(type: MiddleSearchType, isForTag?: boolean) {
    const isSelected = !isForTag && searchType === type;
    switch (type) {
      case 'chat':
        return (
          <PeerChip
            className={buildClassName(styles.searchType, isSelected && styles.selectedType)}
            peerId={chat?.id}
            title={oldLang('SearchThisChat')}
            clickArg="chat"
            onClick={isForTag ? handleDeleteTag : handleChangeSearchType}
          />
        );
      case 'myChats':
        return (
          <PeerChip
            className={buildClassName(styles.searchType, isSelected && styles.selectedType)}
            peerId={currentUserId}
            forceShowSelf
            title={oldLang('SearchMyMessages')}
            clickArg="myChats"
            onClick={isForTag ? handleDeleteTag : handleChangeSearchType}
          />
        );
      case 'channels':
        return (
          <PeerChip
            className={buildClassName(styles.searchType, isSelected && styles.selectedType)}
            customPeer={CHANNELS_PEER}
            title={oldLang('SearchPublicPosts')}
            clickArg="channels"
            onClick={isForTag ? handleDeleteTag : handleChangeSearchType}
          />
        );
    }
    return undefined;
  }

  function renderDropdown() {
    return (
      <div className={buildClassName(styles.dropdown, !hasResultsDropdown && styles.dropdownHidden)}>
        {!isMobile && <div className={styles.separator} />}
        {hasSavedTags && !isHashtagQuery && (
          <div
            className={buildClassName(
              styles.savedTags,
              !isMobile && styles.wrap,
              'no-scrollbar',
            )}
          >
            {savedTagsArray.map((tag) => {
              const isChosen = isSameReaction(tag.reaction, savedTag);
              return (
                <SavedTagButton
                  containerId="local-search"
                  key={getReactionKey(tag.reaction)}
                  reaction={tag.reaction}
                  tag={tag}
                  withCount
                  isDisabled={areSavedTagsDisabled}
                  isChosen={isChosen}
                  onClick={isChosen ? removeSearchSavedTag : activateSearchTag}
                />
              );
            })}
          </div>
        )}
        {isHashtagQuery && (
          <div
            className={buildClassName(styles.searchTypes, 'no-scrollbar')}
          >
            {renderTypeTag('chat')}
            {renderTypeTag('myChats')}
            {renderTypeTag('channels')}
          </div>
        )}
        {hasResultsContainer && (
          <InfiniteScroll
            ref={containerRef}
            className={buildClassName(styles.results, 'custom-scroll')}
            items={viewportResults}
            itemSelector={`.${RESULT_ITEM_CLASS_NAME}`}
            preloadBackwards={0}
            onLoadMore={getMore}
            onKeyDown={handleKeyDown}
          >
            {areResultsEmpty && (
              <span key="nothing" className={styles.placeholder}>
                {oldLang('NoResultFoundFor', query)}
              </span>
            )}
            {isOnlyHash && (
              <span key="enterhash" className={styles.placeholder}>
                {oldLang('HashtagSearchPlaceholder')}
              </span>
            )}
            {viewportResults?.map(({
              message, senderPeer, messageChat, searchResultKey,
            }, i) => (
              <MiddleSearchResult
                key={searchResultKey}
                teactOrderKey={-message.date}
                className={RESULT_ITEM_CLASS_NAME}
                query={query}
                message={message}
                senderPeer={senderPeer}
                messageChat={messageChat}
                shouldShowChat={isHashtagQuery}
                isActive={focusedIndex - viewportOffset === i}
                onClick={handleMessageClick}
              />
            ))}
          </InfiniteScroll>
        )}
      </div>
    );
  }

  return (
    <div
      id="MiddleSearch"
      className={buildClassName(
        styles.root,
        isActive && styles.active,
        !isActive && isFullyHidden && 'visually-hidden', // `display: none` would prevent focus on iOS
        isFocused && styles.focused,
        isMobile && styles.mobile,
      )}
      ref={ref}
    >
      <div className={styles.header}>
        {!isMobile && (
          <Avatar
            className={styles.avatar}
            peer={monoforumChat || chat}
            size="medium"
            isSavedMessages={isSavedMessages}
          />
        )}
        <SearchInput
          ref={inputRef}
          value={query}
          className={buildClassName(
            styles.input,
            hasResultsDropdown && styles.withDropdown,
            hasResultsDropdown && !isMobile && styles.adaptSearchBorders,
          )}
          canClose={!isMobile}
          isLoading={isLoading}
          resultsItemSelector={`.${styles.results} .${RESULT_ITEM_CLASS_NAME}`}
          hasUpButton={hasNavigationButtons && !isMobile}
          hasDownButton={hasNavigationButtons && !isMobile}
          placeholder={isHashtagQuery ? oldLang('SearchHashtagsHint') : oldLang('Search')}
          teactExperimentControlled
          onChange={handleQueryChange}
          onStartBackspace={handleDeleteTag}
          onReset={handleReset}
          withBackIcon={isMobile}
          onFocus={markFocused}
          focused={isFocused}
          onUpClick={canFocusOlder ? handleFocusOlder : undefined}
          onDownClick={canFocusNewer ? handleFocusNewer : undefined}
        >
          <div className={styles.searchTags}>
            {savedTag && (
              <SavedTagButton
                containerId="local-search-tags"
                className={styles.savedSearchTag}
                reaction={savedTag}
                tag={savedTags![getReactionKey(savedTag)]}
                onClick={removeSearchSavedTag}
              />
            )}
            {isHashtagQuery && <div className={styles.hash}>#</div>}
          </div>
          {!isMobile && renderDropdown()}
        </SearchInput>
        {!isMobile && (
          <div className={styles.icons}>
            <Button
              round
              size="smaller"
              color="translucent"
              onClick={() => openHistoryCalendar({ selectedAt: getDayStartAt(Date.now()) })}
              ariaLabel={oldLang('JumpToDate')}
              iconName="calendar"
            />
          </div>
        )}
      </div>
      {isMobile && renderDropdown()}
      {isMobile && (
        <div className={styles.footer}>
          <Button
            round
            size="smaller"
            color="translucent"
            onClick={() => openHistoryCalendar({ selectedAt: getDayStartAt(Date.now()) })}
            ariaLabel={oldLang('JumpToDate')}
            iconName="calendar"
          />
          <div className={styles.counter}>
            {hasQueryData && (
              foundIds?.length ? (
                oldLang('Of', [Math.max(focusedIndex + 1, 1), totalCount])
              ) : foundIds && !foundIds.length && (
                oldLang('NoResult')
              )
            )}
          </div>
          {searchType === 'chat' && Boolean(foundIds?.length) && (
            <Button
              className={styles.viewStyle}
              size="smaller"
              isText
              fluid
              noForcedUpperCase
              onClick={handleTriggerViewStyle}
            >
              {isViewAsList ? oldLang('SearchAsChat') : oldLang('SearchAsList')}
            </Button>
          )}
          {hasNavigationButtons && !hasResultsDropdown && (
            <div className={styles.mobileNavigation}>
              <Button
                className={buildClassName(styles.navigationButton, !canFocusOlder && styles.navigationDisabled)}
                round
                size="smaller"
                color="secondary"
                onClick={handleFocusOlder}
                nonInteractive={!canFocusOlder}
                ariaLabel={lang('AriaSearchOlderResult')}
                iconName="up"
              />
              <Button
                className={buildClassName(styles.navigationButton, !canFocusNewer && styles.navigationDisabled)}
                round
                size="smaller"
                color="secondary"
                onClick={handleFocusNewer}
                nonInteractive={!canFocusNewer}
                ariaLabel={lang('AriaSearchNewerResult')}
                iconName="down"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const currentMessageList = selectCurrentMessageList(global);
    if (!currentMessageList) {
      return {} as Complete<StateProps>;
    }
    const { chatId, threadId } = currentMessageList;

    const chat = selectChat(global, chatId);
    if (!chat) {
      return {} as Complete<StateProps>;
    }

    const {
      requestedQuery, savedTag, results, fetchingQuery, isHashtag, type,
    } = selectCurrentMiddleSearch(global) || {};
    const { totalCount, foundIds, query: lastSearchQuery } = results || {};

    const currentUserId = global.currentUserId;
    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const isSavedDialog = getIsSavedDialog(chatId, threadId, currentUserId);

    const savedTags = isSavedMessages && !isSavedDialog ? global.savedReactionTags?.byKey : undefined;

    const monoforumChat = selectMonoforumChannel(global, chatId);

    return {
      chat,
      monoforumChat,
      requestedQuery,
      totalCount,
      threadId,
      foundIds,
      isHistoryCalendarOpen: Boolean(selectTabState(global).historyCalendarSelectedAt),
      savedTags,
      savedTag,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isSavedMessages,
      fetchingQuery,
      isHashtagQuery: isHashtag,
      currentUserId,
      searchType: type,
      lastSearchQuery,
    };
  },
)(MiddleSearch));
