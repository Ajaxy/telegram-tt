import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import { AudioOrigin, LoadMoreDirection } from '../../../types';
import type { StateProps } from './helpers/createMapStateToProps';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { createMapStateToProps } from './helpers/createMapStateToProps';
import { formatMonthAndYear, toYearMonth } from '../../../util/dateFormat';
import { getSenderName } from './helpers/getSenderName';
import { throttle } from '../../../util/schedulers';
import buildClassName from '../../../util/buildClassName';

import useAsyncRendering from '../../right/hooks/useAsyncRendering';
import useLang from '../../../hooks/useLang';

import InfiniteScroll from '../../ui/InfiniteScroll';
import Audio from '../../common/Audio';
import NothingFound from '../../common/NothingFound';
import Loading from '../../ui/Loading';

export type OwnProps = {
  isVoice?: boolean;
  searchQuery?: string;
};

const runThrottled = throttle((cb) => cb(), 500, true);

const AudioResults: FC<OwnProps & StateProps> = ({
  theme,
  isVoice,
  searchQuery,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  activeDownloads,
}) => {
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
      const [chatId, messageId] = id.split('_');

      return globalMessagesByChatId[chatId]?.byId[Number(messageId)];
    }).filter(Boolean);
  }, [globalMessagesByChatId, foundIds]);

  const handleMessageFocus = useCallback((messageId: number, chatId: string) => {
    focusMessage({ chatId, messageId });
  }, [focusMessage]);

  const handlePlayAudio = useCallback((messageId: number, chatId: string) => {
    openAudioPlayer({ chatId, messageId });
  }, [openAudioPlayer]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const isFirst = index === 0;
      const shouldDrawDateDivider = isFirst
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <div
          className="ListItem small-icon"
          key={message.id}
        >
          {shouldDrawDateDivider && (
            <p
              className={buildClassName(
                'section-heading',
                isFirst && 'section-heading-first',
                !isFirst && 'section-heading-with-border',
              )}
              dir={lang.isRtl ? 'rtl' : undefined}
            >
              {formatMonthAndYear(lang, new Date(message.date * 1000))}
            </p>
          )}
          <Audio
            key={message.id}
            theme={theme}
            message={message}
            origin={AudioOrigin.Search}
            senderTitle={getSenderName(lang, message, chatsById, usersById)}
            date={message.date}
            className="scroll-item"
            onPlay={handlePlayAudio}
            onDateClick={handleMessageFocus}
            canDownload={!chatsById[message.chatId]?.isProtected && !message.isProtected}
            isDownloading={activeDownloads[message.chatId]?.ids?.includes(message.id)}
          />
        </div>
      );
    });
  }

  const canRenderContents = useAsyncRendering([searchQuery], SLIDE_TRANSITION_DURATION) && !isLoading;

  return (
    <div className="LeftSearch">
      <InfiniteScroll
        className="search-content documents-list custom-scroll"
        items={foundMessages}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!canRenderContents && <Loading />}
        {canRenderContents && (!foundIds || foundIds.length === 0) && (
          <NothingFound
            text={lang('ChatList.Search.NoResults')}
            description={lang('ChatList.Search.NoResultsDescription')}
          />
        )}
        {canRenderContents && foundIds && foundIds.length > 0 && renderList()}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  createMapStateToProps('audio'),
)(AudioResults));
