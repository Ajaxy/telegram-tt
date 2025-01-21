import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ThreadId } from '../../../types';

import { PEER_PICKER_ITEM_HEIGHT_PX } from '../../../config';
import {
  getCanPostInChat, getGroupStatus, getUserStatus, isUserOnline,
} from '../../../global/helpers';
import { isApiPeerChat } from '../../../global/helpers/peers';
import { selectPeer, selectTopics, selectUserStatus } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { REM } from '../helpers/mediaDimensions';
import renderText from '../helpers/renderText';

import useSelector from '../../../hooks/data/useSelector';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useInputFocusOnOpen from '../../../hooks/useInputFocusOnOpen';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import InfiniteScroll from '../../ui/InfiniteScroll';
import InputText from '../../ui/InputText';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';
import Transition from '../../ui/Transition';
import Avatar from '../Avatar';
import FullNameTitle from '../FullNameTitle';
import Icon from '../icons/Icon';
import TopicIcon from '../TopicIcon';
import PickerItem from './PickerItem';

import './ChatOrUserPicker.scss';

export type OwnProps = {
  currentUserId?: string;
  chatOrUserIds: string[];
  isOpen: boolean;
  searchPlaceholder: string;
  search: string;
  className?: string;
  loadMore?: NoneToVoidFunction;
  onSearchChange: (search: string) => void;
  onSelectChatOrUser: (chatOrUserId: string, threadId?: ThreadId) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const CHAT_LIST_SLIDE = 0;
const TOPIC_LIST_SLIDE = 1;
const TOPIC_ICON_SIZE = 2.75 * REM;
const ITEM_CLASS_NAME = 'ChatOrUserPicker-item';
const TOPIC_ITEM_HEIGHT_PX = 56;

const ChatOrUserPicker: FC<OwnProps> = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
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

  const lang = useOldLang();
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

  const selectTopicsById = useLastCallback((global: GlobalState) => {
    if (!forumId) {
      return undefined;
    }

    return selectTopics(global, forumId);
  });

  const forumTopicsById = useSelector(selectTopicsById);

  const [topicIds, topics] = useMemo(() => {
    const global = getGlobal();
    const chatsById = global.chats.byId;
    const chatFullInfoById = global.chats.fullInfoById;

    const chat = chatsById[forumId!];

    if (!chat || !forumTopicsById) {
      return [undefined, undefined];
    }

    const searchTitle = topicSearch.toLowerCase();

    const result = forumTopicsById
      ? Object.values(forumTopicsById).reduce((acc, topic) => {
        if (
          getCanPostInChat(chat, topic, undefined, chatFullInfoById[forumId!])
          && (!searchTitle || topic.title.toLowerCase().includes(searchTitle))
        ) {
          acc[topic.id] = topic;
        }

        return acc;
      }, {} as Record<number, ApiTopic>)
      : forumTopicsById;

    return [Object.keys(result).map(Number), result];
  }, [forumId, topicSearch, forumTopicsById]);

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

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      const chatsById = getGlobal().chats.byId;

      const chatId = viewportIds[index === -1 ? 0 : index];
      const chat = chatsById[chatId];
      if (chat?.isForum) {
        if (!forumTopicsById) loadTopics({ chatId });
        setForumId(chatId);
      } else {
        onSelectChatOrUser(chatId);
      }
    }
  }, `.${ITEM_CLASS_NAME}`, true);

  const handleTopicKeyDown = useKeyboardListNavigation(topicContainerRef, isOpen, (index) => {
    if (topicIds?.length) {
      onSelectChatOrUser(forumId!, topicIds[index === -1 ? 0 : index]);
    }
  }, `.${ITEM_CLASS_NAME}`, true);

  const handleClick = useLastCallback((chatId: string) => {
    const chatsById = getGlobal().chats.byId;
    const chat = chatsById?.[chatId];
    if (chat?.isForum) {
      if (!forumTopicsById) loadTopics({ chatId });
      setForumId(chatId);
      resetSearch();
    } else {
      onSelectChatOrUser(chatId);
    }
  });

  const renderChatItem = useCallback((id: string, index: number) => {
    const global = getGlobal();
    const peer = selectPeer(global, id);
    if (!peer) {
      return undefined;
    }

    const isSelf = peer && !isApiPeerChat(peer) ? peer.isSelf : undefined;

    function getSubtitle() {
      if (!peer) return undefined;
      if (peer.id === currentUserId) return [lang('SavedMessagesInfo')];
      if (isApiPeerChat(peer)) {
        return [getGroupStatus(lang, peer)];
      }

      const userStatus = selectUserStatus(global, peer.id);
      return [
        getUserStatus(lang, peer, userStatus),
        buildClassName(isUserOnline(peer, userStatus, true) && 'online'),
      ];
    }

    const [subtitle, subtitleClassName] = getSubtitle() || [];

    return (
      <PickerItem
        key={id}
        className={ITEM_CLASS_NAME}
        title={<FullNameTitle peer={peer} isSavedMessages={isSelf} />}
        avatarElement={(
          <Avatar
            peer={peer}
            isSavedMessages={isSelf}
            size="medium"
          />
        )}
        subtitle={subtitle}
        subtitleClassName={subtitleClassName}
        ripple
        style={`top: ${(viewportOffset + index) * PEER_PICKER_ITEM_HEIGHT_PX}px;`}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => handleClick(id)}
      />
    );
  }, [currentUserId, lang, viewportOffset]);

  function renderTopicList() {
    return (
      <>
        <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
          <Button round color="translucent" size="smaller" ariaLabel={lang('Back')} onClick={handleHeaderBackClick}>
            <Icon name="arrow-left" />
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
          maxHeight={(topicIds?.length || 0) * TOPIC_ITEM_HEIGHT_PX}
          onKeyDown={handleTopicKeyDown}
        >
          {!topicIds && <Loading />}
          {topicIds?.map((topicId, i) => (
            <PickerItem
              key={`${forumId}_${topicId}`}
              className={ITEM_CLASS_NAME}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => onSelectChatOrUser(forumId!, topicId)}
              style={`top: ${(viewportOffset + i) * TOPIC_ITEM_HEIGHT_PX}px;`}
              avatarElement={(
                <TopicIcon
                  size={TOPIC_ICON_SIZE}
                  topic={topics[topicId]}
                  className="topic-icon"
                  letterClassName="topic-icon-letter"
                />
              )}
              title={renderText(topics[topicId].title)}
            />
          ))}
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
            <Icon name="close" />
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
            itemSelector={`.${ITEM_CLASS_NAME}`}
            onLoadMore={getMore}
            withAbsolutePositioning
            maxHeight={chatOrUserIds!.length * PEER_PICKER_ITEM_HEIGHT_PX}
            onKeyDown={handleKeyDown}
          >
            {viewportIds.map(renderChatItem)}
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
