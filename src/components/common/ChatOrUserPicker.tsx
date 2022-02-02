import { RefObject } from 'react';
import React, {
  FC, memo, useRef, useCallback,
} from '../../lib/teact/teact';

import { CHAT_HEIGHT_PX } from '../../config';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useInputFocusOnOpen from '../../hooks/useInputFocusOnOpen';
import { isUserId } from '../../modules/helpers';

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
  filterRef: RefObject<HTMLInputElement>;
  filterPlaceholder: string;
  filter: string;
  loadMore: NoneToVoidFunction;
  onFilterChange: (filter: string) => void;
  onSelectChatOrUser: (chatOrUserId: string) => void;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
};

const ChatOrUserPicker: FC<OwnProps> = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
  filterRef,
  filter,
  filterPlaceholder,
  loadMore,
  onFilterChange,
  onSelectChatOrUser,
  onClose,
  onCloseAnimationEnd,
}) => {
  const lang = useLang();
  const [viewportIds, getMore] = useInfiniteScroll(loadMore, chatOrUserIds, Boolean(filter));

  const resetFilter = useCallback(() => {
    onFilterChange('');
  }, [onFilterChange]);
  useInputFocusOnOpen(filterRef, isOpen, resetFilter);

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange(e.currentTarget.value);
  }, [onFilterChange]);
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
        ref={filterRef}
        value={filter}
        onChange={handleFilterChange}
        onKeyDown={handleKeyDown}
        placeholder={filterPlaceholder}
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
