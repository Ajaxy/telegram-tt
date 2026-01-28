import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../../api/types';
import { MAIN_THREAD_ID } from '../../../../api/types';

import { MESSAGE_SEARCH_SLICE } from '../../../../config';
import { selectSender } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { debounce } from '../../../../util/schedulers';
import { canUseMessageForBulkSend } from '../../../util/messageTemplate';
import { callApi } from '../../../../api/gramjs';

import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import Icon from '../../../../components/common/icons/Icon';
import MiddleSearchResult from '../../../../components/middle/search/MiddleSearchResult';
import Button from '../../../../components/ui/Button';
import InfiniteScroll from '../../../../components/ui/InfiniteScroll';
import InputText from '../../../../components/ui/InputText';

import styles from './TemplateMessageSelector.module.scss';

type OwnProps = {
  chat: ApiChat;
  peer: ApiPeer;
  onSelect: (message: ApiMessage, albumMessages?: ApiMessage[]) => void;
  onClose: () => void;
};

type SearchResult = {
  message: ApiMessage;
  senderPeer?: ApiPeer;
};

const RESULT_ITEM_CLASS_NAME = 'TemplateSearchResult';
const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const TemplateMessageSelector = ({
  chat,
  peer,
  onSelect,
  onClose,
}: OwnProps) => {
  const lang = useTelebizLang();
  const oldLang = useOldLang();

  const inputRef = useRef<HTMLInputElement | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | undefined>(undefined);

  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundMessages, setFoundMessages] = useState<ApiMessage[]>([]);
  const [nextOffsetId, setNextOffsetId] = useState<number | undefined>(undefined);

  // Chronological messages state (when no query)
  const [chronoMessages, setChronoMessages] = useState<ApiMessage[]>([]);
  const [chronoNextOffsetId, setChronoNextOffsetId] = useState<number | undefined>(undefined);
  const [isChronoLoading, setIsChronoLoading] = useState(false);

  const shouldCancelSearchRef = useRef(false);

  const fetchChronologicalMessages = useLastCallback(async (offsetId?: number) => {
    if (!chat) return;

    setIsChronoLoading(true);

    try {
      const result = await callApi('fetchMessages', {
        chat,
        threadId: MAIN_THREAD_ID,
        limit: MESSAGE_SEARCH_SLICE,
        offsetId,
      });

      if (!result) {
        setIsChronoLoading(false);
        return;
      }

      const { messages } = result;
      const lastMessage = messages[messages.length - 1];

      if (offsetId) {
        setChronoMessages((prev) => [...prev, ...messages]);
      } else {
        setChronoMessages(messages);
      }
      setChronoNextOffsetId(lastMessage?.id);
    } catch (e) {
      // Silently fail
    } finally {
      setIsChronoLoading(false);
    }
  });

  const performSearch = useLastCallback(async (searchQuery: string, offsetId?: number) => {
    if (!peer || shouldCancelSearchRef.current) return;

    setIsLoading(true);

    try {
      const result = await callApi('searchMessagesInChat', {
        peer,
        type: 'text',
        query: searchQuery,
        threadId: MAIN_THREAD_ID,
        limit: MESSAGE_SEARCH_SLICE,
        offsetId,
      });

      if (!result || shouldCancelSearchRef.current) {
        return;
      }

      const { messages, nextOffsetId: nextOffset } = result;

      if (offsetId) {
        setFoundMessages((prev) => [...prev, ...messages]);
      } else {
        setFoundMessages(messages);
      }
      setNextOffsetId(nextOffset);
    } catch (e) {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  });

  const handleSearch = useLastCallback(() => {
    if (!query) return;

    runDebouncedForSearch(() => {
      if (shouldCancelSearchRef.current) return;
      performSearch(query);
    });
  });

  const handleQueryChange = useLastCallback((newQuery: string) => {
    shouldCancelSearchRef.current = false;
    setQuery(newQuery);

    if (!newQuery) {
      setIsLoading(false);
      setFoundMessages([]);
      setNextOffsetId(undefined);
      shouldCancelSearchRef.current = true;
    }
  });

  // Load chronological messages on mount
  useEffect(() => {
    fetchChronologicalMessages();
  }, [chat]);

  useEffect(() => {
    if (query) {
      handleSearch();
    }
  }, [query]);

  const handleLoadMore = useLastCallback(() => {
    if (query) {
      if (nextOffsetId && !isLoading) {
        performSearch(query, nextOffsetId);
      }
    } else if (chronoNextOffsetId && !isChronoLoading) {
      fetchChronologicalMessages(chronoNextOffsetId);
    }
  });

  const { viewportResults, albumsMap } = useMemo(() => {
    const messagesToDisplay = query ? foundMessages : chronoMessages;
    if (!messagesToDisplay.length) return { viewportResults: [], albumsMap: new Map<number, ApiMessage[]>() };

    const global = getGlobal();

    // Group messages by groupedId to handle albums
    const albumMap = new Map<string, ApiMessage[]>();
    const standaloneMessages: ApiMessage[] = [];
    const seenGroupedIds = new Set<string>();

    // Filter out action messages and unsupported types
    const filteredMessages = messagesToDisplay.filter((message) => {
      if (message.content.action) return false;
      return canUseMessageForBulkSend(message);
    });

    filteredMessages.forEach((message) => {
      if (message.groupedId && message.isInAlbum) {
        if (!seenGroupedIds.has(message.groupedId)) {
          seenGroupedIds.add(message.groupedId);
          albumMap.set(message.groupedId, [message]);
        } else {
          albumMap.get(message.groupedId)!.push(message);
        }
      } else {
        standaloneMessages.push(message);
      }
    });

    // Get the main message from each album and build message ID to album map
    const albumMainMessages: ApiMessage[] = [];
    const messageIdToAlbum = new Map<number, ApiMessage[]>();
    albumMap.forEach((albumMessages) => {
      const messageWithText = albumMessages.find((msg) => msg.content.text);
      const mainMessage = messageWithText || albumMessages[0];
      albumMainMessages.push(mainMessage);
      // Map the main message ID to sorted album messages
      messageIdToAlbum.set(mainMessage.id, albumMessages.sort((a, b) => a.id - b.id));
    });

    // Combine and sort by date
    const allMessages = [...standaloneMessages, ...albumMainMessages].sort((a, b) => b.date - a.date);

    const results: SearchResult[] = allMessages.map((message) => {
      const senderPeer = selectSender(global, message);

      return {
        message,
        senderPeer,
      };
    });

    return { viewportResults: results, albumsMap: messageIdToAlbum };
  }, [query, foundMessages, chronoMessages]);

  const handleMessageClick = useLastCallback((message: ApiMessage) => {
    const albumMessages = albumsMap.get(message.id);
    onSelect(message, albumMessages);
  });

  const areSearchResultsEmpty = Boolean(query && !foundMessages.length && !isLoading);
  const hasResults = viewportResults.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button
          round
          size="smaller"
          color="translucent"
          iconName="arrow-left"
          onClick={onClose}
          ariaLabel={oldLang('Common.Back')}
        />
        <h3 className={styles.title}>{lang('TemplateCampaign.SelectTemplateMessage')}</h3>
      </div>

      <div className={styles.searchContainer}>
        <InputText
          ref={inputRef}
          value={query}
          className={styles.input}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={lang('TemplatesChats.Search')}
        />
      </div>

      {hasResults && (
        <InfiniteScroll
          ref={containerRef}
          className={buildClassName(styles.results, 'custom-scroll')}
          items={viewportResults}
          itemSelector={`.${RESULT_ITEM_CLASS_NAME}`}
          preloadBackwards={0}
          onLoadMore={handleLoadMore}
        >
          {viewportResults.map(({ message, senderPeer }) => (
            <MiddleSearchResult
              key={`${message.chatId}-${message.id}`}
              className={buildClassName(RESULT_ITEM_CLASS_NAME, styles.resultItem)}
              query={query}
              message={message}
              senderPeer={senderPeer}
              onClick={handleMessageClick}
            />
          ))}
        </InfiniteScroll>
      )}

      {areSearchResultsEmpty && (
        <div className={styles.placeholder}>
          <Icon name="search" className={styles.placeholderIcon} />
          <p>{lang('TemplatesChats.NoResults', { query })}</p>
        </div>
      )}

      {!hasResults && !query && !isChronoLoading && (
        <div className={styles.placeholder}>
          <Icon name="document" className={styles.placeholderIcon} />
          <p>{lang('TemplatesChats.NoMessages')}</p>
        </div>
      )}
    </div>
  );
};

export default memo(TemplateMessageSelector);
