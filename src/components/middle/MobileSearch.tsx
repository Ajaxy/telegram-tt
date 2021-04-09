import React, {
  FC, memo, useCallback, useEffect, useRef, useState, useLayoutEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiChat } from '../../api/types';
import { GlobalActions } from '../../global/types';

import { debounce } from '../../util/schedulers';
import { selectCurrentTextSearch, selectCurrentChat } from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import SearchInput from '../ui/SearchInput';
import CalendarModal from '../common/CalendarModal';

import './MobileSearch.scss';

export type OwnProps = {
  isActive: boolean;
};

type StateProps = {
  isActive?: boolean;
  chat?: ApiChat;
  query?: string;
  totalCount?: number;
  foundIds?: number[];
};

type DispatchProps = Pick<GlobalActions, (
  'setLocalTextSearchQuery' | 'searchTextMessagesLocal' | 'closeLocalTextSearch' | 'searchMessagesByDate' |
  'focusMessage'
)>;

const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const MobileSearchFooter: FC<StateProps & DispatchProps> = ({
  isActive,
  chat,
  query,
  totalCount,
  foundIds,
  setLocalTextSearchQuery,
  searchTextMessagesLocal,
  focusMessage,
  closeLocalTextSearch,
  searchMessagesByDate,
}) => {
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();

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
        mainEl.style.transform = `translateY(${pageTop}px)`;
        mainEl.style.height = `${height}px`;
        document.documentElement.scrollTop = pageTop;
      } else {
        mainEl.style.transform = '';
        mainEl.style.height = '';
      }
    };

    visualViewport.addEventListener('resize', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
    };
  }, []);

  // Focus message
  useEffect(() => {
    if (chat && foundIds && foundIds.length) {
      focusMessage({ chatId: chat.id, messageId: foundIds[foundIds.length - 1] });
      setFocusedIndex(0);
    } else {
      setFocusedIndex(-1);
    }
  }, [chat, focusMessage, foundIds]);

  // Disable native up/down buttons on iOS
  useEffect(() => {
    Array.from(document.querySelectorAll<HTMLInputElement>('input')).forEach((input) => {
      input.disabled = Boolean(isActive && input !== inputRef.current);
    });

    Array.from(document.querySelectorAll<HTMLDivElement>('div[contenteditable]')).forEach((div) => {
      div.contentEditable = isActive ? 'false' : 'true';
    });
  }, [isActive]);

  // Blur on exit
  useEffect(() => {
    if (!isActive) {
      inputRef.current!.blur();
    }
  }, [isActive]);

  useLayoutEffect(() => {
    const searchInput = document.querySelector<HTMLInputElement>('#MobileSearch input')!;
    searchInput.blur();
  }, [isCalendarOpen]);

  const handleMessageSearchQueryChange = useCallback((newQuery: string) => {
    setLocalTextSearchQuery({ query: newQuery });

    if (newQuery.length) {
      runDebouncedForSearch(searchTextMessagesLocal);
    }
  }, [searchTextMessagesLocal, setLocalTextSearchQuery]);

  const handleJumpToDate = useCallback((date: Date) => {
    searchMessagesByDate({ timestamp: date.valueOf() / 1000 });
    closeCalendar();
  }, [closeCalendar, searchMessagesByDate]);

  const handleUp = useCallback(() => {
    if (chat && foundIds) {
      const newFocusIndex = focusedIndex + 1;
      focusMessage({ chatId: chat.id, messageId: foundIds[foundIds.length - 1 - newFocusIndex] });
      setFocusedIndex(newFocusIndex);
    }
  }, [chat, focusedIndex, focusMessage, foundIds]);

  const handleDown = useCallback(() => {
    if (chat && foundIds) {
      const newFocusIndex = focusedIndex - 1;
      focusMessage({ chatId: chat.id, messageId: foundIds[foundIds.length - 1 - newFocusIndex] });
      setFocusedIndex(newFocusIndex);
    }
  }, [chat, focusedIndex, focusMessage, foundIds]);

  const lang = useLang();

  return (
    <div id="MobileSearch" className={isActive ? 'active' : ''}>
      <div className="header">
        <Button
          size="smaller"
          round
          color="translucent"
          onClick={closeLocalTextSearch}
        >
          <i className="icon-arrow-left" />
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
            foundIds && foundIds.length ? (
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
              onClick={openCalendar}
              ariaLabel="Search messages by date"
            >
              <i className="icon-calendar" />
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
          <i className="icon-up" />
        </Button>
        <Button
          round
          size="smaller"
          color="translucent"
          onClick={handleDown}
          disabled={!foundIds || !foundIds.length || focusedIndex === 0}
        >
          <i className="icon-down" />
        </Button>
      </div>
      <CalendarModal
        isOpen={isCalendarOpen}
        isPastMode
        submitButtonLabel={lang('JumpToDate')}
        onClose={closeCalendar}
        onSubmit={handleJumpToDate}
      />
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
    const { totalCount, foundIds } = results || {};

    return {
      chat,
      query,
      totalCount,
      foundIds,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setLocalTextSearchQuery',
    'searchTextMessagesLocal',
    'focusMessage',
    'closeLocalTextSearch',
    'searchMessagesByDate',
  ]),
)(MobileSearchFooter));
