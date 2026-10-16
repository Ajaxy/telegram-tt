import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { StateProps } from './helpers/createMapStateToProps';
import { MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { getIsDownloading } from '../../../global/helpers';
import { selectMessageDownloadableMedia } from '../../../global/selectors/media';
import { toYearMonth } from '../../../util/dates/dateMath';
import { parseSearchResultKey } from '../../../util/keys/searchResultKey';
import { formatDateTime, secondsToDate } from '../../../util/localization/dateFormat';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { throttle } from '../../../util/schedulers';
import { createMapStateToProps } from './helpers/createMapStateToProps';
import { getSenderName } from './helpers/getSenderName';

import useLang from '../../../hooks/useLang';
import useAsyncRendering from '../../right/hooks/useAsyncRendering';

import Audio from '../../common/Audio';
import NothingFound from '../../common/NothingFound';
import Island from '../../gili/layout/Island';
import InfiniteScroll from '../../ui/InfiniteScroll';
import Loading from '../../ui/Loading';
import Transition from '../../ui/Transition.tsx';

export type OwnProps = {
  isVoice?: boolean;
  searchQuery?: string;
};

const runThrottled = throttle((cb) => cb(), 500, true);

const AudioResults = ({
  theme,
  isVoice,
  searchQuery,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  activeDownloads,
}: OwnProps & StateProps) => {
  const {
    searchMessagesGlobal,
    focusMessage,
    openAudioPlayer,
  } = getActions();

  const lang = useLang();
  const currentType = isVoice ? 'voice' : 'audio';
  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: currentType,
        });
      });
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps -- `searchQuery` is required to prevent infinite message loading
  }, [currentType, searchMessagesGlobal, searchQuery]);

  const foundMessages = useMemo(() => {
    if (!foundIds || !globalMessagesByChatId) {
      return MEMO_EMPTY_ARRAY;
    }

    return foundIds.map((id) => {
      const [chatId, messageId] = parseSearchResultKey(id);

      return globalMessagesByChatId[chatId]?.byId[messageId];
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleMessageFocus = useCallback((message: ApiMessage) => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
  }, [focusMessage]);

  const handlePlayAudio = useCallback((messageId: number, chatId: string) => {
    openAudioPlayer({
      item: {
        type: 'message', chatId, threadId: MAIN_THREAD_ID, messageId,
      },
    });
  }, [openAudioPlayer]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const global = getGlobal();
      const isFirst = index === 0;
      const shouldDrawDateDivider = isFirst
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);

      const media = selectMessageDownloadableMedia(global, message)!;
      return (
        <>
          {shouldDrawDateDivider && (
            <p
              className="section-heading"
              key={message.date}
              dir={lang.isRtl ? 'rtl' : undefined}
            >
              {formatDateTime(lang, secondsToDate(message.date), { date: 'long', includeDay: false })}
            </p>
          )}
          <div
            className="ListItem small-icon"
            key={message.id}
          >
            <Audio
              key={message.id}
              theme={theme}
              message={message}
              variant="search"
              senderTitle={getSenderName(lang, message, chatsById, usersById)}
              date={message.date}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
              canDownload={!chatsById[message.chatId]?.isProtected && !message.isProtected}
              isDownloading={getIsDownloading(activeDownloads, media)}
            />
          </div>
        </>
      );
    });
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <Transition
      slideClassName="LeftSearch--content"
      name="fade"
      activeKey={canRenderContents ? 1 : 0}
      shouldCleanup
    >
      <InfiniteScroll
        className="search-content documents-list custom-scroll"
        items={canRenderContents ? foundMessages : undefined}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && (!foundIds || foundIds.length === 0) && (
          <NothingFound
            withSticker
            text={lang('ChatListSearchNoResults')}
            description={lang('ChatListSearchNoResultsDescription')}
          />
        )}
        {canRenderContents && foundIds && foundIds.length > 0 && (
          <Island className="search-island">
            {renderList()}
          </Island>
        )}
      </InfiniteScroll>
    </Transition>
  );
};

export default memo(withGlobal<OwnProps>(
  createMapStateToProps('audio'),
)(AudioResults));
