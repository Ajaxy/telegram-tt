import type { ElementRef, TeactNode } from '../../../lib/teact/teact';
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiTopic } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { AnimationLevel, ThreadId } from '../../../types';

import { PEER_PICKER_ITEM_HEIGHT_PX } from '../../../config';
import {
  getCanPostInChat, getGroupStatus, getUserStatus, isUserOnline,
} from '../../../global/helpers';
import { isApiPeerChat } from '../../../global/helpers/peers';
import {
  selectMonoforumChannel,
  selectPeer,
  selectTabState,
  selectTopics,
  selectUserStatus,
} from '../../../global/selectors';
import { selectAnimationLevel } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import {
  buildChatSelectionKey,
  type ChatSelectionKey,
  includesChatSelectionKey,
} from '../../../util/keys/chatSelectionKey';
import { resolveTransitionName } from '../../../util/resolveTransitionName';
import { REM } from '../helpers/mediaDimensions';
import renderText from '../helpers/renderText';

import useSelector from '../../../hooks/data/useSelector';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useInputFocusOnOpen from '../../../hooks/useInputFocusOnOpen';
import useKeyboardListNavigation from '../../../hooks/useKeyboardListNavigation';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import InfiniteScroll, { type OwnProps as InfiniteScrollProps } from '../../ui/InfiniteScroll';
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
  title?: string;
  searchPlaceholder: string;
  search: string;
  className?: string;
  isLowStackPriority?: boolean;
  listActiveKey?: number;
  subheader?: TeactNode;
  renderSearchRow?: (props: SearchRowRenderProps) => TeactNode;
  footer?: TeactNode;
  viewportFooter?: TeactNode;
  selectedIds?: ChatSelectionKey[];
  loadMore?: NoneToVoidFunction;
  onSearchChange: (search: string) => void;
  onSelectChatOrUser: (chatOrUserId: string, threadId?: ThreadId) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

type StateProps = {
  animationLevel: AnimationLevel;
  shouldSkipHistoryAnimations?: boolean;
};

const CHAT_LIST_SLIDE = 0;
const TOPIC_LIST_SLIDE = 1;
const TOPIC_ICON_SIZE = 2.75 * REM;
const ITEM_CLASS_NAME = 'ChatOrUserPicker-item';
const TOPIC_ITEM_HEIGHT_PX = 56;

export type SearchRowRenderProps = {
  inputRef: ElementRef<HTMLInputElement>;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
};

const ChatOrUserPicker = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
  title,
  search,
  searchPlaceholder,
  className,
  isLowStackPriority,
  subheader,
  renderSearchRow,
  footer,
  viewportFooter,
  listActiveKey,
  selectedIds,
  animationLevel,
  shouldSkipHistoryAnimations,
  loadMore,
  onSearchChange,
  onSelectChatOrUser,
  onClose,
  onCloseAnimationEnd,
}: OwnProps & StateProps) => {
  const { loadTopics } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const [chatKeyDownHandler, setChatKeyDownHandler] = useState<React.KeyboardEventHandler<HTMLDivElement>>();
  const topicContainerRef = useRef<HTMLDivElement>();
  const searchRef = useRef<HTMLInputElement>();
  const topicSearchRef = useRef<HTMLInputElement>();
  const [viewportIds, getMore] = useInfiniteScroll(loadMore, chatOrUserIds, Boolean(search));
  const [forumId, setForumId] = useState<string | undefined>(undefined);
  const [topicSearch, setTopicSearch] = useState<string>('');
  const activeKey = forumId ? TOPIC_LIST_SLIDE : CHAT_LIST_SLIDE;
  const viewportOffset = chatOrUserIds.indexOf(viewportIds![0]);

  const resetSearch = useLastCallback(() => {
    onSearchChange('');
  });
  useInputFocusOnOpen(searchRef, isOpen && activeKey === CHAT_LIST_SLIDE, resetSearch);
  useInputFocusOnOpen(topicSearchRef, isOpen && activeKey === TOPIC_LIST_SLIDE);

  const selectTopicsById = useCallback((global: GlobalState) => {
    if (!forumId) {
      return undefined;
    }

    return selectTopics(global, forumId);
  }, [forumId]);

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

  const handleChatSelect = useLastCallback((index) => {
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
  });

  const handleKeyDownHandlerUpdate = useLastCallback((handler: React.KeyboardEventHandler<HTMLDivElement>) => {
    setChatKeyDownHandler(() => handler);
  });

  const handleTopicKeyDown = useKeyboardListNavigation(topicContainerRef, isOpen, (index) => {
    if (topicIds?.length) {
      onSelectChatOrUser(forumId!, topicIds[index === -1 ? 0 : index]);
    }
  }, `.${ITEM_CLASS_NAME}`, true);

  const isMultiSelect = Boolean(selectedIds);

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
    let peer = selectPeer(global, id);
    if (!peer) {
      return undefined;
    }

    const monoforumChannel = selectMonoforumChannel(global, id);
    if (monoforumChannel) {
      peer = monoforumChannel;
    }

    const chat = global.chats.byId[id];
    const isForum = chat?.isForum;

    const isSelf = peer && !isApiPeerChat(peer) ? peer.isSelf : undefined;
    const isSelected = selectedIds && includesChatSelectionKey(selectedIds, buildChatSelectionKey(id));

    const selectedTopicsCount = isForum && selectedIds
      ? selectedIds.filter((key) => key.peerId === id && key.topicId !== undefined).length
      : 0;
    const hasSelectedTopics = selectedTopicsCount > 0;

    function getSubtitle() {
      if (!peer) return undefined;
      if (peer.id === currentUserId) return [oldLang('SavedMessagesInfo')];
      if (isApiPeerChat(peer)) {
        return [getGroupStatus(lang, peer)];
      }

      const userStatus = selectUserStatus(global, peer.id);
      return [
        getUserStatus(oldLang, peer, userStatus),
        buildClassName(isUserOnline(peer, userStatus, true) && 'online'),
      ];
    }

    const [subtitle, subtitleClassName] = getSubtitle() || [];

    const checkboxElement = selectedIds ? (
      <div className={buildClassName('picker-checkbox', (isSelected || hasSelectedTopics) && 'selected')}>
        {(isSelected || hasSelectedTopics) && <Icon name="check-bold" />}
        {hasSelectedTopics && (
          <div className="picker-checkbox-count">{selectedTopicsCount}</div>
        )}
      </div>
    ) : undefined;

    return (
      <PickerItem
        key={id}
        className={ITEM_CLASS_NAME}
        title={(
          <div className="title-wrapper">
            <FullNameTitle
              className="item-title"
              peer={peer}
              isMonoforum={Boolean(monoforumChannel)}
              isSavedMessages={isSelf}
            />
          </div>
        )}
        avatarElement={(
          <div className="picker-avatar-wrapper">
            <Avatar
              peer={peer}
              asMessageBubble={Boolean(monoforumChannel)}
              isSavedMessages={isSelf}
              size="medium"
            />
            {isForum && <Icon name="forums" className="forum-badge" />}
          </div>
        )}
        inputElement={checkboxElement}
        inputPosition="end"
        subtitle={subtitle}
        subtitleClassName={subtitleClassName}
        ripple
        style={`top: ${(viewportOffset + index) * PEER_PICKER_ITEM_HEIGHT_PX}px;`}

        onClick={() => handleClick(id)}
      />
    );
  }, [currentUserId, oldLang, lang, viewportOffset, selectedIds]);

  function renderTopicList() {
    return (
      <>
        <div className="picker-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {renderSearchRow ? renderSearchRow({
            inputRef: topicSearchRef,
            value: topicSearch,
            placeholder: searchPlaceholder,
            onChange: handleTopicSearchChange,
            onKeyDown: handleTopicKeyDown,
          }) : (
            <div className="search-input-wrapper">
              <i className="icon icon-search" />
              <input
                ref={topicSearchRef}
                className="search-input"
                type="text"
                dir="auto"
                placeholder={searchPlaceholder}
                value={topicSearch}
                onChange={handleTopicSearchChange}
                onKeyDown={handleTopicKeyDown}
              />
            </div>
          )}
        </div>
        {topicIds?.length ? (
          <InfiniteScroll
            ref={topicContainerRef}
            className="picker-list custom-scroll"
            items={topicIds}
            withAbsolutePositioning
            maxHeight={(topicIds?.length || 0) * TOPIC_ITEM_HEIGHT_PX}
            onKeyDown={handleTopicKeyDown}
          >
            {topicIds.map((topicId, i) => {
              const chatSelectionKey = buildChatSelectionKey(forumId!, topicId);
              const isTopicSelected = selectedIds && includesChatSelectionKey(selectedIds, chatSelectionKey);

              const topicCheckboxElement = isMultiSelect ? (
                <div className={buildClassName('picker-checkbox', isTopicSelected && 'selected')}>
                  {isTopicSelected && <Icon name="check-bold" />}
                </div>
              ) : undefined;

              return (
                <PickerItem
                  key={`${forumId}_${topicId}`}
                  className={ITEM_CLASS_NAME}
                  onClick={() => onSelectChatOrUser(forumId!, topicId)}
                  style={`top: ${i * TOPIC_ITEM_HEIGHT_PX}px;`}
                  avatarElement={(
                    <div className="picker-avatar-wrapper">
                      <TopicIcon
                        size={TOPIC_ICON_SIZE}
                        topic={topics[topicId]}
                        className="topic-icon"
                        letterClassName="topic-icon-letter"
                      />
                    </div>
                  )}
                  title={renderText(topics[topicId].title)}
                  inputElement={topicCheckboxElement}
                  inputPosition="end"
                />
              );
            })}
            {Boolean(viewportFooter) && (
              <div
                className="picker-list-spacer"
                style={`top: ${topicIds.length * TOPIC_ITEM_HEIGHT_PX}px`}
              />
            )}
          </InfiniteScroll>
        ) : topicIds && !topicIds.length ? (
          <p className="no-results">{lang('NothingFound')}</p>
        ) : (
          <div className="picker-list picker-list-loading">
            <Loading />
          </div>
        )}
      </>
    );
  }

  function renderChatList() {
    return (
      <>
        <div className="picker-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {renderSearchRow ? renderSearchRow({
            inputRef: searchRef,
            value: search,
            placeholder: searchPlaceholder,
            onChange: handleSearchChange,
            onKeyDown: chatKeyDownHandler,
          }) : (
            <div className="search-input-wrapper">
              <i className="icon icon-search" />
              <input
                ref={searchRef}
                className="search-input"
                type="text"
                dir="auto"
                placeholder={searchPlaceholder}
                value={search}
                onChange={handleSearchChange}
                onKeyDown={chatKeyDownHandler}
              />
            </div>
          )}
          {subheader}
        </div>
        <Transition
          activeKey={listActiveKey || 0}
          name={resolveTransitionName('slideOptimized', animationLevel, shouldSkipHistoryAnimations, lang.isRtl)}
          slideClassName="ChatOrUserPicker_slide"
        >
          <ChatListContent
            isOpen={isOpen}
            viewportIds={viewportIds}
            maxHeight={chatOrUserIds.length * PEER_PICKER_ITEM_HEIGHT_PX}
            viewportFooter={viewportFooter}
            onLoadMore={getMore}
            onSelect={handleChatSelect}
            renderItem={renderChatItem}
            onKeyDownHandlerUpdate={handleKeyDownHandlerUpdate}
          />
        </Transition>
      </>
    );
  }

  const handleModalClose = useLastCallback(() => {
    if (forumId) {
      handleHeaderBackClick();
    } else {
      onClose();
    }
  });

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      hasCloseButton
      isBackButton={Boolean(forumId)}
      headerClassName="modal-header-condensed-wide"
      className={buildClassName('ChatOrUserPicker', className)}
      isLowStackPriority={isLowStackPriority}
      onClose={handleModalClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      <Transition activeKey={activeKey} name="slideFade" slideClassName="ChatOrUserPicker_slide">
        {() => {
          return activeKey === TOPIC_LIST_SLIDE ? renderTopicList() : renderChatList();
        }}
      </Transition>
      {footer}
    </Modal>
  );
};

type ChatListContentProps = {
  isOpen: boolean;
  viewportIds?: string[];
  maxHeight: number;
  viewportFooter?: TeactNode;
  onLoadMore: InfiniteScrollProps['onLoadMore'];
  onSelect: (index: number) => void;
  renderItem: (id: string, index: number) => TeactNode;
  onKeyDownHandlerUpdate: (handler: React.KeyboardEventHandler<HTMLDivElement>) => void;
};

function ChatListContent({
  isOpen,
  viewportIds,
  maxHeight,
  viewportFooter,
  onLoadMore,
  onSelect,
  onKeyDownHandlerUpdate,
  renderItem,
}: ChatListContentProps) {
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();

  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, onSelect, `.${ITEM_CLASS_NAME}`, true);

  useEffect(() => {
    onKeyDownHandlerUpdate(handleKeyDown);
  }, [handleKeyDown, onKeyDownHandlerUpdate]);

  return (
    <>
      {viewportIds?.length ? (
        <InfiniteScroll
          ref={containerRef}
          className="picker-list custom-scroll"
          items={viewportIds}
          itemSelector={`.${ITEM_CLASS_NAME}`}
          onLoadMore={onLoadMore}
          withAbsolutePositioning
          maxHeight={maxHeight}
          onKeyDown={handleKeyDown}
        >
          {viewportIds.map(renderItem)}
          {Boolean(viewportFooter) && (
            <div className="picker-list-spacer" style={`top: ${maxHeight}px`} />
          )}
        </InfiniteScroll>
      ) : viewportIds && !viewportIds.length ? (
        <p className="no-results">{lang('NothingFound')}</p>
      ) : (
        <Loading />
      )}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      animationLevel: selectAnimationLevel(global),
      shouldSkipHistoryAnimations: selectTabState(global).shouldSkipHistoryAnimations,
    };
  },
)(ChatOrUserPicker));
