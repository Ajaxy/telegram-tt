/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat, ApiTopic } from '../../api/types';

/* import { CHAT_HEIGHT_PX } from '../../config'; */
import { getCanPostInChat, isUserId } from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import InputText from '../ui/InputText';
import ListItem from '../ui/ListItem';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import GroupChatInfo from './GroupChatInfo';
import PrivateChatInfo from './PrivateChatInfo';
import TopicIcon from './TopicIcon';

import './ChatOrUserPicker.scss';

export type OwnProps = {
  currentUserId?: string;
  chatOrUserIds: string[];
  chatsById?: Record<string, ApiChat>;
  isOpen: boolean;
  searchPlaceholder: string;
  search: string;
  className?: string;
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
  className,
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

  const resetSearch = useLastCallback(() => {
    onSearchChange('');
  });
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

  const handleHeaderBackClick = useLastCallback(() => {
    setForumId(undefined);
    setTopicSearch('');
  });

  const handleSearchChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.currentTarget.value);
  });

  const handleTopicSearchChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTopicSearch(e.currentTarget.value);
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent<any>) => {
    if (!viewportIds || viewportIds.length === 0) {
      return;
    }

    let newIndex = selectedIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = selectedIndex < viewportIds.length - 1 ? selectedIndex + 1 : viewportIds.length - 1;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
    }

    if (newIndex !== selectedIndex) {
      setSelectedIndex(newIndex);
    // Дополнительно: Прокрутите до элемента, если он не полностью видим
    }

    if (e.key === 'Enter' && selectedIndex >= 0) {
      const chatId = viewportIds[selectedIndex];
      const chat = chatsById?.[chatId];
      if (chat?.isForum) {
        if (!chat.topics) loadTopics({ chatId });
        setForumId(chatId);
      } else {
        onSelectChatOrUser(chatId);
      }
    }
  };
  const [selectedTopicIndex, setSelectedTopicIndex] = useState(0);
  const handleTopicKeyDown = (e: React.KeyboardEvent<any>) => {
    if (e.key === 'Backspace' && topicSearch === '') {
      handleHeaderBackClick();
    }
    if (!topicIds || topicIds.length === 0) {
      return;
    }

    let newIndex = selectedTopicIndex;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      newIndex = selectedTopicIndex < topicIds.length - 1 ? selectedTopicIndex + 1 : selectedTopicIndex;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      newIndex = selectedTopicIndex > 0 ? selectedTopicIndex - 1 : 0;
    }

    if (newIndex !== selectedTopicIndex) {
      setSelectedTopicIndex(newIndex);
      // Опционально: Прокрутка до элемента, если он не полностью видим
    }

    if (e.key === 'Enter' && newIndex >= 0) {
      const topicId = topicIds[newIndex];
      onSelectChatOrUser(forumId!, topicId);
    }
  };

  const handleClick = useLastCallback((e: React.MouseEvent, chatId: string) => {
    const chat = chatsById?.[chatId];
    if (chat?.isForum) {
      if (!chat.topics) loadTopics({ chatId });
      setForumId(chatId);
      resetSearch();
    } else {
      onSelectChatOrUser(chatId);
    }
  });

  const handleTopicClick = useLastCallback((e: React.MouseEvent, topicId: number) => {
    onSelectChatOrUser(forumId!, topicId);
  });

  const CHAT_HEIGHT_PX = window.innerWidth > 680 ? 48 : 72;

  function renderTopicList() {
    return (
      <>
        <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={handleHeaderBackClick}>
            <i className="icon icon-arrow-left" />
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
                // eslint-disable-next-line max-len
                className={`${selectedTopicIndex === i ? 'selected' : ''} chat-item-clickable force-rounded-corners small-icon`}
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
            className="close-button"
            ariaLabel={lang('Close')}
            onClick={onClose}
          >
            <i className="icon icon-close" />
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
                // eslint-disable-next-line max-len
                className={`${selectedIndex === i ? 'selected' : ''} chat-item-clickable force-rounded-corners small-icon`}
                style={`height: ${CHAT_HEIGHT_PX}px; top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
                onClick={handleClick}
                clickArg={id}
              >
                {isUserId(id) ? (
                  <PrivateChatInfo
                    status={id === currentUserId ? lang('SavedMessagesInfo') : undefined}
                    userId={id}
                    avatarSize={window.innerWidth > 680 ? 'nano' : 'medium'}
                  />
                ) : (
                  <GroupChatInfo chatId={id} avatarSize={window.innerWidth > 680 ? 'nano' : 'medium'} />
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
      className={buildClassName('ChatOrUserPicker', className)}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      <Transition activeKey={activeKey} name="slideFade" slideClassName="ChatOrUserPicker_slide">
        {() => {
          return activeKey === TOPIC_LIST_SLIDE ? renderTopicList() : renderChatList();
        }}
      </Transition>
    </Modal>
  );
};

export default memo(ChatOrUserPicker);
