import type { FC } from '../../lib/teact/teact';
import React, { memo, useRef, useCallback } from '../../lib/teact/teact';

import { CHAT_HEIGHT_PX } from '../../config';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import { isUserId } from '../../global/helpers';

import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import InputText from '../ui/InputText';
import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import GroupChatInfo from './GroupChatInfo';
import PrivateChatInfo from './PrivateChatInfo';

import './ChatOrUserPicker.scss';

export type OwnProps = {
  currentUserId?: string;
  chatOrUserIds: string[];
  isOpen: boolean;
  searchPlaceholder: string;
  search: string;
  loadMore?: NoneToVoidFunction;
  onSearchChange: (search: string) => void;
  onSelectChatOrUser: (chatOrUserId: string) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const ChatOrUserPicker: FC<OwnProps> = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
  search,
  searchPlaceholder,
  loadMore,
  onSearchChange,
  onSelectChatOrUser,
  onClose,
  onCloseAnimationEnd,
}) => {
  const lang = useLang();
  const [viewportIds, getMore] = useInfiniteScroll(loadMore, chatOrUserIds, Boolean(search));
  // eslint-disable-next-line no-null/no-null
  const searchRef = useRef<HTMLInputElement>(null);

  const resetSearch = useCallback(() => {
    onSearchChange('');
  }, [onSearchChange]);
  useInputFocusOnOpen(searchRef, isOpen, resetSearch);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.currentTarget.value);
  }, [onSearchChange]);
  const handleKeyDown = useKeyboardListNavigation(containerRef, isOpen, (index) => {
    if (viewportIds && viewportIds.length > 0) {
      onSelectChatOrUser(viewportIds[index === -1 ? 0 : index]);
    }
  }, '.ListItem-button', true);

  const modalHeader = (
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
  );

  const viewportOffset = chatOrUserIds!.indexOf(viewportIds![0]);

  return (
    <Modal
      isOpen={isOpen}
      className="ChatOrUserPicker"
      header={modalHeader}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
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
              className="chat-item-clickable force-rounded-corners"
              style={`top: ${(viewportOffset + i) * CHAT_HEIGHT_PX}px;`}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => onSelectChatOrUser(id)}
            >
              {isUserId(id) ? (
                <PrivateChatInfo status={id === currentUserId ? lang('SavedMessagesInfo') : undefined} userId={id} />
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
    </Modal>
  );
};

export default memo(ChatOrUserPicker);
