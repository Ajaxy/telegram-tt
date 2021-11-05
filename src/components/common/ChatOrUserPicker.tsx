import { RefObject } from 'react';
import React, {
  FC, memo, useRef, useCallback,
} from '../../lib/teact/teact';

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
  onFilterChange: (filter: string) => void;
  loadMore: NoneToVoidFunction;
  onSelectChatOrUser: (chatOrUserId: string) => void;
  onClose: NoneToVoidFunction;
};

const ChatOrUserPicker: FC<OwnProps> = ({
  isOpen,
  currentUserId,
  chatOrUserIds,
  filterRef,
  filter,
  filterPlaceholder,
  onFilterChange,
  onClose,
  loadMore,
  onSelectChatOrUser,
}) => {
  const lang = useLang();
  const [viewportIds, getMore] = useInfiniteScroll(loadMore, chatOrUserIds, Boolean(filter));

  useInputFocusOnOpen(filterRef, isOpen, () => { onFilterChange(''); });

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="ChatOrUserPicker"
      header={modalHeader}
    >
      {viewportIds?.length ? (
        <InfiniteScroll
          className="picker-list custom-scroll"
          items={viewportIds}
          onLoadMore={getMore}
          noScrollRestore={Boolean(filter)}
          ref={containerRef}
          onKeyDown={handleKeyDown}
        >
          {viewportIds.map((id) => (
            <ListItem
              key={id}
              className="chat-item-clickable force-rounded-corners"
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
