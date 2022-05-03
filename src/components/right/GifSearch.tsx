import React, {
  FC, memo, useRef, useCallback,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiChat, ApiVideo } from '../../api/types';

import { IS_TOUCH_ENV } from '../../util/environment';
import {
  selectCurrentGifSearch,
  selectChat,
  selectIsChatWithBot,
  selectCurrentMessageList,
  selectCanScheduleUntilOnline,
  selectIsChatWithSelf,
} from '../../global/selectors';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';
import useSchedule from '../../hooks/useSchedule';

import InfiniteScroll from '../ui/InfiniteScroll';
import GifButton from '../common/GifButton';
import Loading from '../ui/Loading';

import './GifSearch.scss';

type OwnProps = {
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  query?: string;
  results?: ApiVideo[];
  chat?: ApiChat;
  isChatWithBot?: boolean;
  canScheduleUntilOnline?: boolean;
  isSavedMessages?: boolean;
  canPostInChat?: boolean;
};

const PRELOAD_BACKWARDS = 96; // GIF Search bot results are multiplied by 24
const INTERSECTION_DEBOUNCE = 300;

const GifSearch: FC<OwnProps & StateProps> = ({
  isActive,
  query,
  results,
  chat,
  isChatWithBot,
  canScheduleUntilOnline,
  isSavedMessages,
  canPostInChat,
  onClose,
}) => {
  const {
    searchMoreGifs,
    sendMessage,
    setGifSearchQuery,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  const canSendGifs = canPostInChat && getAllowedAttachmentOptions(chat, isChatWithBot).canSendGifs;

  const handleGifClick = useCallback((gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => {
    if (canSendGifs) {
      if (shouldSchedule) {
        requestCalendar((scheduledAt) => {
          sendMessage({ gif, scheduledAt, isSilent });
        });
      } else {
        sendMessage({ gif, isSilent });
      }
    }

    if (IS_TOUCH_ENV) {
      setGifSearchQuery({ query: undefined });
    }
  }, [canSendGifs, requestCalendar, sendMessage, setGifSearchQuery]);

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  function renderContent() {
    if (query === undefined) {
      return undefined;
    }

    if (!results) {
      return (
        <Loading />
      );
    }

    if (!results.length) {
      return (
        <p className="helper-text" dir="auto">{lang('NoGIFsFound')}</p>
      );
    }

    return results.map((gif) => (
      <GifButton
        key={gif.id}
        gif={gif}
        observeIntersection={observeIntersection}
        onClick={canSendGifs ? handleGifClick : undefined}
        isSavedMessages={isSavedMessages}
      />
    ));
  }

  const hasResults = Boolean(query !== undefined && results && results.length);

  return (
    <div className="GifSearch" dir={lang.isRtl ? 'rtl' : undefined}>
      <InfiniteScroll
        ref={containerRef}
        className={buildClassName('gif-container custom-scroll', hasResults && 'grid')}
        items={results}
        itemSelector=".GifButton"
        preloadBackwards={PRELOAD_BACKWARDS}
        noFastList
        onLoadMore={searchMoreGifs}
      >
        {renderContent()}
      </InfiniteScroll>
      {calendar}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const currentSearch = selectCurrentGifSearch(global);
    const { query, results } = currentSearch || {};
    const { chatId, threadId } = selectCurrentMessageList(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const isChatWithBot = chat ? selectIsChatWithBot(global, chat) : undefined;
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);
    const canPostInChat = Boolean(chat) && Boolean(threadId) && getCanPostInChat(chat, threadId);

    return {
      query,
      results,
      chat,
      isChatWithBot,
      isSavedMessages,
      canPostInChat,
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
    };
  },
)(GifSearch));
