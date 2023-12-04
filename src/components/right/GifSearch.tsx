import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiVideo } from '../../api/types';
import type { MessageList } from '../../global/types';

import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';
import {
  selectCanScheduleUntilOnline,
  selectChat,
  selectCurrentGifSearch,
  selectCurrentMessageList,
  selectIsChatWithBot,
  selectIsChatWithSelf, selectThreadInfo,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useHistoryBack from '../../hooks/useHistoryBack';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useSchedule from '../../hooks/useSchedule';

import GifButton from '../common/GifButton';
import InfiniteScroll from '../ui/InfiniteScroll';
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
  currentMessageList?: MessageList;
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
  currentMessageList,
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
      if (!currentMessageList) {
        return;
      }

      if (shouldSchedule) {
        requestCalendar((scheduledAt) => {
          sendMessage({
            messageList: currentMessageList,
            gif,
            scheduledAt,
            isSilent,
          });
        });
      } else {
        sendMessage({ messageList: currentMessageList, gif, isSilent });
      }
    }

    if (IS_TOUCH_ENV) {
      setGifSearchQuery({ query: undefined });
    }
  }, [canSendGifs, currentMessageList, requestCalendar]);

  const handleSearchMoreGifs = useCallback(() => {
    searchMoreGifs();
  }, [searchMoreGifs]);

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
        onLoadMore={handleSearchMoreGifs}
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
    const threadInfo = chatId && threadId ? selectThreadInfo(global, chatId, threadId) : undefined;
    const isMessageThread = Boolean(!threadInfo?.isCommentsInfo && threadInfo?.fromChannelId);
    const canPostInChat = Boolean(chat) && Boolean(threadId) && getCanPostInChat(chat, threadId, isMessageThread);

    return {
      query,
      results,
      chat,
      isChatWithBot,
      isSavedMessages,
      canPostInChat,
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
      currentMessageList: selectCurrentMessageList(global),
    };
  },
)(GifSearch));
