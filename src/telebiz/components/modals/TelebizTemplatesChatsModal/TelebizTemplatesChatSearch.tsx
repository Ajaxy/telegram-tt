import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { ApiChat, ApiMessage, ApiPeer } from '../../../../api/types';
import type { MessageList } from '../../../../types';
import { MAIN_THREAD_ID } from '../../../../api/types';

import { MESSAGE_SEARCH_SLICE } from '../../../../config';
import {
  selectChat, selectCurrentMessageList, selectPeer, selectPoll, selectSender,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { isUserId } from '../../../../util/entities/ids';
import { debounce } from '../../../../util/schedulers';
import {
  canUseMessageAsTemplate,
  convertPollToNewPoll,
  convertTodoToNewTodo,
  downloadMessageMedia,
  extractMessageText,
  getMessageContact,
  getMessageGif,
  getMessagePollId,
  getTemplateSticker,
  getTemplateTodo,
  hasDownloadableMedia,
} from '../../../util/messageTemplate';
import { callApi } from '../../../../api/gramjs';

import useLastCallback from '../../../../hooks/useLastCallback';
import { useTelebizLang } from '../../../hooks/useTelebizLang';

import MiddleSearchResult from '../../../../components/middle/search/MiddleSearchResult';
import InfiniteScroll from '../../../../components/ui/InfiniteScroll';
import InputText from '../../../../components/ui/InputText';

import styles from './TelebizTemplatesChatSearch.module.scss';

type OwnProps = {
  chatId: string;
  handleCloseModal: () => void;
};

type StateProps = {
  chat?: ApiChat;
  peer?: ApiPeer;
  currentChatId?: string;
  currentChat?: ApiChat;
};

type SearchResult = {
  message: ApiMessage;
  senderPeer?: ApiPeer;
};

const RESULT_ITEM_CLASS_NAME = 'TemplateSearchResult';
const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

const TelebizTemplatesChatSearch = ({
  chat,
  peer,
  currentChatId,
  currentChat,
  handleCloseModal,
}: OwnProps & StateProps) => {
  const lang = useTelebizLang();
  const { openChatWithDraft, showNotification, sendMessage } = getActions();

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
      showNotification({ message: 'Failed to load messages' });
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
      showNotification({ message: 'Failed to search messages' });
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

  const viewportResults = useMemo((): SearchResult[] => {
    const messagesToDisplay = query ? foundMessages : chronoMessages;
    if (!messagesToDisplay.length) return [];

    const global = getGlobal();

    // Group messages by groupedId to handle albums
    const albumMap = new Map<string, ApiMessage[]>();
    const standaloneMessages: ApiMessage[] = [];
    const seenGroupedIds = new Set<string>();

    const filteredMessages = messagesToDisplay.filter((message) => !message.content.action);

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

    // Get the main message from each album (first message, or one with text/caption)
    const albumMainMessages: ApiMessage[] = [];
    albumMap.forEach((albumMessages) => {
      // Find message with text/caption, or use the first one
      const messageWithText = albumMessages.find((msg) => msg.content.text);
      albumMainMessages.push(messageWithText || albumMessages[0]);
    });

    // Combine standalone messages and album main messages, then sort by date
    const allMessages = [...standaloneMessages, ...albumMainMessages].sort((a, b) => b.date - a.date);

    return allMessages.map((message) => {
      const senderPeer = selectSender(global, message);

      return {
        message,
        senderPeer,
      };
    });
  }, [query, foundMessages, chronoMessages]);

  const handleMessageSelect = useLastCallback(async (message: ApiMessage) => {
    if (!currentChatId || !currentChat) return;

    // Check if message type is supported
    if (!canUseMessageAsTemplate(message)) {
      showNotification({ message: lang('TemplatesChats.UnsupportedMessageType') });
      return;
    }

    handleCloseModal();

    const messageList: MessageList = {
      chatId: currentChatId,
      threadId: MAIN_THREAD_ID,
      type: 'thread',
    };

    // Contacts are sent immediately since they can't be drafted
    const contact = getMessageContact(message);
    if (contact) {
      sendMessage({ messageList, contact });
      return;
    }

    // Polls are sent immediately since they can't be drafted
    // Note: Polls can only be sent in groups/channels, not private chats (except bots/saved messages)
    const pollId = getMessagePollId(message);
    if (pollId) {
      const isPrivateChat = isUserId(currentChatId);
      if (isPrivateChat) {
        showNotification({ message: lang('TemplatesChats.InvalidMediaForChatType') });
        return;
      }

      const global = getGlobal();
      const existingPoll = selectPoll(global, pollId);
      if (existingPoll) {
        const poll = convertPollToNewPoll(existingPoll);
        sendMessage({ messageList, poll });
      }
      return;
    }

    // Stickers are sent immediately
    const sticker = getTemplateSticker(message);
    if (sticker) {
      sendMessage({ messageList, sticker });
      return;
    }

    // GIFs are sent immediately
    const gif = getMessageGif(message);
    if (gif) {
      sendMessage({ messageList, gif });
      return;
    }

    // Todos are sent immediately
    const todo = getTemplateTodo(message);
    if (todo) {
      const newTodo = convertTodoToNewTodo(todo);
      sendMessage({ messageList, todo: newTodo });
      return;
    }

    // Handle album messages - get all messages in the album
    let messagesToProcess: ApiMessage[] = [message];
    if (message.groupedId && message.isInAlbum) {
      const messagesToDisplay = query ? foundMessages : chronoMessages;
      const albumMessages = messagesToDisplay.filter(
        (msg) => msg.groupedId === message.groupedId && msg.isInAlbum,
      );
      // Only use album messages if we found them, otherwise fall back to single message
      if (albumMessages.length > 0) {
        // Sort by message ID to preserve original order
        messagesToProcess = albumMessages.sort((a, b) => a.id - b.id);
      }
    }

    // Extract text from all messages (prefer message with text, or combine if multiple)
    let text = extractMessageText(message);
    const messagesWithText = messagesToProcess.filter((msg) => extractMessageText(msg));
    if (messagesWithText.length > 1) {
      // Combine text from all messages with text
      const combinedText = messagesWithText
        .map((msg) => extractMessageText(msg)?.text || '')
        .filter(Boolean)
        .join('\n\n');
      if (combinedText) {
        text = { text: combinedText };
      }
    } else if (messagesWithText.length === 1) {
      text = extractMessageText(messagesWithText[0]);
    }

    const options = {
      chatId: currentChatId,
      text: text || { text: '' },
      files: [] as File[],
    };

    // Download media from all messages in the album
    const allFiles: File[] = [];
    for (const msg of messagesToProcess) {
      if (hasDownloadableMedia(msg)) {
        try {
          const mediaFiles = await downloadMessageMedia(msg);
          allFiles.push(...mediaFiles.map((m) => m.file));
        } catch (e) {
          showNotification({ message: 'Failed to download some media' });
        }
      }
    }

    if (allFiles.length > 0) {
      options.files = allFiles;
    }

    openChatWithDraft(options);
  });

  const areSearchResultsEmpty = Boolean(query && !foundMessages.length && !isLoading);
  const hasResults = viewportResults.length > 0;

  return (
    <div className={styles.root}>

      <InputText
        ref={inputRef}
        value={query}
        className={styles.input}

        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder={lang('TemplatesChats.Search')}
      />
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
              onClick={handleMessageSelect}
            />
          ))}
        </InfiniteScroll>
      )}
      {areSearchResultsEmpty && (
        <div className={styles.placeholder}>
          {lang('TemplatesChats.NoResults', { query })}
        </div>
      )}
      {!hasResults && !query && !isChronoLoading && (
        <div className={styles.placeholder}>
          {lang('TemplatesChats.NoMessages')}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const peer = selectPeer(global, chatId);
    const currentMessageList = selectCurrentMessageList(global);
    const currentChat = currentMessageList?.chatId ? selectChat(global, currentMessageList.chatId) : undefined;

    return {
      chat,
      peer,
      currentChatId: currentMessageList?.chatId,
      currentChat,
    };
  },
)(TelebizTemplatesChatSearch));
