import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useRef, useCallback, useState, useMemo,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat, ApiTopic } from '../../api/types';

import { REM } from './helpers/mediaDimensions';
import { CHAT_HEIGHT_PX } from '../../config';
import renderText from './helpers/renderText';
import { getCanPostInChat, isUserId } from '../../global/helpers';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';

import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import InputText from '../ui/InputText';
import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import GroupChatInfo from './GroupChatInfo';
import PrivateChatInfo from './PrivateChatInfo';
import Transition from '../ui/Transition';
import TopicIcon from './TopicIcon';

import './ChatOrUserPicker.scss';

export type OwnProps = {
  currentUserId?: string;
  chatOrUserIds: string[];
  chatsById?: Record<string, ApiChat>;
  isOpen: boolean;
  searchPlaceholder: string;
  search: string;
  loadMore?: NoneToVoidFunction;
  onSearchChange: (search: string) => void;
  onSelectChatOrUser: (chatOrUserId: string, threadId?: number) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const CHAT_LIST_SLIDE = 0;
const TOPIC_LIST_SLIDE = 1;
const TOPIC_ICON_SIZE = 2.75 * REM;

const ChatOrUserPicker: FC<OwnProps> = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
  chatsById,
  search,
  searchPlaceholder,
  loadMore,
  onSearchChange,
  onSelectChatOrUser,
  onClose,
  onCloseAnimationEnd,
}) => {
  const { loadTopics } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const topicContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const searchRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const topicSearchRef = useRef<HTMLInputElement>(null);
  const [viewportIds, getMore] = useInfiniteScroll(loadMore, chatOrUserIds, Boolean(search));
  const [forumId, setForumId] = useState<string | undefined>(undefined);
  const [topicSearch, setTopicSearch] = useState<string>('');
  const activeKey = forumId ? TOPIC_LIST_SLIDE : CHAT_LIST_SLIDE;
  const viewportOffset = chatOrUserIds!.indexOf(viewportIds![0]);

  const resetSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);
  useInputFocusOnOpen(searchRef, isOpen && activeKey === CHAT_LIST_SLIDE, resetSearch);
  useInputFocusOnOpen(topicSearchRef, isOpen && activeKey === TOPIC_LIST_SLIDE);

  const [topicIds, topics] = useMemo(() => {
    const topicsResult = forumId ? chatsById?.[forumId].topics : undefined;
    if (!topicsResult) {
      return [undefined, undefined];
    }

    const searchTitle = topicSearch.toLowerCase();

    const result = topicsResult
      ? Object.values(topicsResult).reduce((acc, topic) => {
        if (
          getCanPostInChat(chatsById![forumId!], topic.id)
          && (!searchTitle || topic.title.toLowerCase().includes(searchTitle))
        ) {
          acc[topic.id] = topic;
        }

        return acc;
      }, {} as Record<number, ApiTopic>)
      : topicsResult;

    return [Object.keys(result).map(Number), result];
  }, [chatsById, forumId, topicSearch]);

  const handleHeaderBackClick = useCallback(() => {
    setForumId(undefined);
    setTopicSearch('');
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.currentTarget.value);
  }, [onSearchChange]);

  const handleTopicSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTopicSearch(e.currentTarget.value);
  }, []);

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      const chatId = viewportIds[index === -1 ? 0 : index];
      const chat = chatsById?.[chatId];
      if (chat?.isForum) {
        if (!chat.topics) loadTopics({ chatId });
        setForumId(chatId);
      } else {
        onSelectChatOrUser(chatId);
      }
    }
  }, '.ListItem-button', true);

  const handleTopicKeyDown = useKeyboardListNavigation(topicContainerRef, isOpen, (index) => {
    if (topicIds?.length) {
      onSelectChatOrUser(forumId!, topicIds[index === -1 ? 0 : index]);
    }
  }, '.ListItem-button', true);

  const handleClick = useCallback((e: React.MouseEvent, chatId: string) => {
    const chat = chatsById?.[chatId];
    if (chat?.isForum) {
      if (!chat.topics) loadTopics({ chatId });
      setForumId(chatId);
      resetSearch();
    } else {
      onSelectChatOrUser(chatId);
    }
  }, [chatsById, loadTopics, onSelectChatOrUser, resetSearch]);

  const handleTopicClick = useCallback((e: React.MouseEvent, topicId: number) => {
    onSelectChatOrUser(forumId!, topicId);
  }, [forumId, onSelectChatOrUser]);

  function renderTopicList() {
    return (
      <>
        <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={handleHeaderBackClick}>
            <i className="icon-arrow-left" />
          </Button>
          <InputText
            ref={topicSearchRef}
            value={topicSearch}
            onChange={handleTopicSearchChange}
            onKeyDown={handleTopicKeyDown}
            placeholder={searchPlaceholder}
          />
        </div>
        <InfiniteScroll
          ref={topicContainerRef}
          className="picker-list custom-scroll"
          items={topicIds}
          withAbsolutePositioning
          maxHeight={!topicIds ? 0 : topicIds.length * CHAT_HEIGHT_PX}
          onKeyDown={handleTopicKeyDown}
        >
          {topicIds
            ? topicIds.map((topicId, i) => (
              <ListItem
                key={`${forumId}_${topicId}`}
                className="chat-item-clickable force-rounded-corners small-icon topic-item"
                style={`top: ${i * CHAT_HEIGHT_PX}px;`}
                onClick={handleTopicClick}
                clickArg={topicId}
              >
                <TopicIcon
                  size={TOPIC_ICON_SIZE}
                  topic={topics[topicId]}
                  className="topic-icon"
                  letterClassName="topic-icon-letter"
                />
                <div dir="auto" className="fullName">{renderText(topics[topicId].title)}</div>
              </ListItem>
            ))
            : <Loading />}
        </InfiniteScroll>
      </>
    );
  }

  function renderChatList() {
    return (
      <>
        <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button
            round
            color="translucent"
            size="smaller"
            ariaLabel={lang('Close')}
            onClick={onClose}
          >
            <i className="icon-close" />
          </Button>
          <InputText
            ref={searchRef}
            value={search}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
          />
        </div>
        {viewportIds?.length ? (
          <InfiniteScroll
            ref={containerRef}
            className="picker-list custom-scroll"
            items={viewportIds}
            onLoadMore={getMore}
            withAbsolutePositioning
            maxHeight={chatOrUserIds!.length * CHAT_HEIGHT_PX}
            onKeyDown={handleKeyDown}
          >
            {viewportIds.map((id, i) => (
              <ListItem
                key={id}
                className="chat-item-clickable force-rounded-corners small-icon"
                style={`height: ${CHAT_HEIGHT_PX}px; top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
                onClick={handleClick}
                clickArg={id}
              >
                {isUserId(id) ? (
                  <PrivateChatInfo
                    status={id === currentUserId ? lang('SavedMessagesInfo') : undefined}
                    userId={id}
                  />
                ) : (
                  <GroupChatInfo chatId={id} />
                )}
              </ListItem>
            ))}
          </InfiniteScroll>
        ) : viewportIds && !viewportIds.length ? (
          <p className="no-results">{lang('lng_blocked_list_not_found')}</p>
        ) : (
          <Loading />
        )}
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      className="ChatOrUserPicker"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      <Transition activeKey={activeKey} name="slide-fade">
        {() => {
          return activeKey === TOPIC_LIST_SLIDE ? renderTopicList() : renderChatList();
        }}
      </Transition>
    </Modal>
  );
};

export default memo(ChatOrUserPicker);
