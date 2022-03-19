import React, {
  FC, memo, useRef, useCallback,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../modules';

import { ApiChat, ApiVideo } from '../../api/types';

import { IS_TOUCH_ENV } from '../../util/environment';
import {
  selectCurrentGifSearch,
  selectChat,
  selectIsChatWithBot,
  selectCurrentMessageList,
} from '../../modules/selectors';
import { getAllowedAttachmentOptions } from '../../modules/helpers';
import buildClassName from '../../util/buildClassName';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useHistoryBack from '../../hooks/useHistoryBack';

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
};

const PRELOAD_BACKWARDS = 96; // GIF Search bot results are multiplied by 24
const INTERSECTION_DEBOUNCE = 300;

const GifSearch: FC<OwnProps & StateProps> = ({
  onClose,
  isActive,
  query,
  results,
  chat,
  isChatWithBot,
}) => {
  const {
    searchMoreGifs,
    sendMessage,
    setGifSearchQuery,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, debounceMs: INTERSECTION_DEBOUNCE });

  const { canSendGifs } = getAllowedAttachmentOptions(chat, isChatWithBot);

  const handleGifClick = useCallback((gif: ApiVideo) => {
    if (canSendGifs) {
      sendMessage({ gif });
    }

    if (IS_TOUCH_ENV) {
      setGifSearchQuery({ query: undefined });
    }
  }, [canSendGifs, sendMessage, setGifSearchQuery]);

  const lang = useLang();

  useHistoryBack(isActive, onClose);

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
        onClick={handleGifClick}
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
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const currentSearch = selectCurrentGifSearch(global);
    const { query, results } = currentSearch || {};
    const { chatId } = selectCurrentMessageList(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const isChatWithBot = chat ? selectIsChatWithBot(global, chat) : undefined;

    return {
      query,
      results,
      chat,
      isChatWithBot,
    };
  },
)(GifSearch));
