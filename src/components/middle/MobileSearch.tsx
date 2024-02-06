import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect,
  useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { ThreadId } from '../../types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  selectCurrentChat,
  selectCurrentMessageList,
  selectCurrentTextSearch,
  selectTabState,
} from '../../global/selectors';
import { getDayStartAt } from '../../util/dateFormat';
import { debounce } from '../../util/schedulers';
import { IS_IOS } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import SearchInput from '../ui/SearchInput';

import './MobileSearch.scss';

export type OwnProps = {
  isActive: boolean;
};

type StateProps = {
  isActive?: boolean;
  chat?: ApiChat;
  threadId?: ThreadId;
  query?: string;
  totalCount?: number;
  foundIds?: number[];
  isHistoryCalendarOpen?: boolean;
};

const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const MobileSearchFooter: FC<StateProps> = ({
  isActive,
  chat,
  threadId,
  query,
  totalCount,
  foundIds,
  isHistoryCalendarOpen,
}) => {
  const {
    setLocalTextSearchQuery,
    searchTextMessagesLocal,
    focusMessage,
    closeLocalTextSearch,
    openHistoryCalendar,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Fix for iOS keyboard
  useEffect(() => {
    const { visualViewport } = window as any;
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

  // Focus message
  useEffect(() => {
    if (chat?.id && foundIds?.length) {
      focusMessage({ chatId: chat.id, messageId: foundIds[0], threadId });
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  }, [chat?.id, focusMessage, foundIds, threadId]);

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
    }
  }, [isActive]);

  useEffect(() => {
    const searchInput = document.querySelector<HTMLInputElement>('#MobileSearch input')!;
    searchInput.blur();
  }, [isHistoryCalendarOpen]);

  const handleMessageSearchQueryChange = useLastCallback((newQuery: string) => {
    setLocalTextSearchQuery({ query: newQuery });

    if (newQuery.length) {
      runDebouncedForSearch(searchTextMessagesLocal);
    }
  });

  const handleUp = useLastCallback(() => {
    if (chat && foundIds) {
      const newFocusIndex = focusedIndex + 1;
      focusMessage({ chatId: chat.id, messageId: foundIds[newFocusIndex], threadId });
      setFocusedIndex(newFocusIndex);
    }
  });

  const handleDown = useLastCallback(() => {
    if (chat && foundIds) {
      const newFocusIndex = focusedIndex - 1;
      focusMessage({ chatId: chat.id, messageId: foundIds[newFocusIndex], threadId });
      setFocusedIndex(newFocusIndex);
    }
  });

  const handleCloseLocalTextSearch = useLastCallback(() => {
    closeLocalTextSearch();
  });

  return (
    <div id="MobileSearch" className={isActive ? 'active' : ''}>
      <div className="header">
        <Button
          size="smaller"
          round
          color="translucent"
          onClick={handleCloseLocalTextSearch}
        >
          <i className="icon icon-arrow-left" />
        </Button>
        <SearchInput
          ref={inputRef}
          value={query}
          onChange={handleMessageSearchQueryChange}
        />
      </div>
      <div className="footer">
        <div className="counter">
          {query ? (
            foundIds?.length ? (
              `${focusedIndex + 1} of ${totalCount}`
            ) : foundIds && !foundIds.length ? (
              'No results'
            ) : (
              ''
            )
          ) : (
            <Button
              round
              size="smaller"
              color="translucent"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => openHistoryCalendar({ selectedAt: getDayStartAt(Date.now()) })}
              ariaLabel="Search messages by date"
            >
              <i className="icon icon-calendar" />
            </Button>
          )}
        </div>
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleUp}
          disabled={!foundIds || !foundIds.length || focusedIndex === foundIds.length - 1}
        >
          <i className="icon icon-up" />
        </Button>
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleDown}
          disabled={!foundIds || !foundIds.length || focusedIndex === 0}
        >
          <i className="icon icon-down" />
        </Button>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const chat = selectCurrentChat(global);
    if (!chat) {
      return {};
    }

    const { query, results } = selectCurrentTextSearch(global) || {};
    const { threadId } = selectCurrentMessageList(global) || {};
    const { totalCount, foundIds } = results || {};

    return {
      chat,
      query,
      totalCount,
      threadId,
      foundIds,
      isHistoryCalendarOpen: Boolean(selectTabState(global).historyCalendarSelectedAt),
    };
  },
)(MobileSearchFooter));
