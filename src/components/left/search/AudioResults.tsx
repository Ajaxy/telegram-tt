import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { AudioOrigin, LoadMoreDirection } from '../../../types';

import { SLIDE_TRANSITION_DURATION } from '../../../config';
import { MEMO_EMPTY_ARRAY } from '../../../util/memo';
import { createMapStateToProps, StateProps } from './helpers/createMapStateToProps';
import { pick } from '../../../util/iteratees';
import { formatMonthAndYear, toYearMonth } from '../../../util/dateFormat';
import { getSenderName } from './helpers/getSenderName';
import { throttle } from '../../../util/schedulers';
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

type DispatchProps = Pick<GlobalActions, ('searchMessagesGlobal' | 'focusMessage' | 'openAudioPlayer')>;

const runThrottled = throttle((cb) => cb(), 500, true);

const AudioResults: FC<OwnProps & StateProps & DispatchProps> = ({
  theme,
  isVoice,
  searchQuery,
  searchChatId,
  isLoading,
  chatsById,
  usersById,
  globalMessagesByChatId,
  foundIds,
  lastSyncTime,
  activeDownloads,
  searchMessagesGlobal,
  focusMessage,
  openAudioPlayer,
}) => {
  const lang = useLang();
  const currentType = isVoice ? 'voice' : 'audio';
  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (lastSyncTime && direction === LoadMoreDirection.Backwards) {
      runThrottled(() => {
        searchMessagesGlobal({
          type: currentType,
          query: searchQuery,
          chatId: searchChatId,
        });
      });
    }
  }, [currentType, lastSyncTime, searchMessagesGlobal, searchQuery, searchChatId]);

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
    openAudioPlayer({ chatId, messageId, origin: AudioOrigin.Search });
  }, [openAudioPlayer]);

  function renderList() {
    return foundMessages.map((message, index) => {
      const shouldDrawDateDivider = index === 0
        || toYearMonth(message.date) !== toYearMonth(foundMessages[index - 1].date);
      return (
        <div
          className="ListItem small-icon"
          key={message.id}
        >
          {shouldDrawDateDivider && (
            <p className="section-heading" dir={lang.isRtl ? 'rtl' : undefined}>
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
            lastSyncTime={lastSyncTime}
            className="scroll-item"
            onPlay={handlePlayAudio}
            onDateClick={handleMessageFocus}
            isDownloading={activeDownloads[message.chatId]?.includes(message.id)}
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
  (setGlobal, actions): DispatchProps => pick(actions, [
    'searchMessagesGlobal',
    'focusMessage',
    'openAudioPlayer',
  ]),
)(AudioResults));
