import React, {
  FC, useMemo, useState, memo, useRef, useEffect, useCallback,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat, MAIN_THREAD_ID } from '../../api/types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import {
  getCanPostInChat, getChatTitle, isChatPrivate, sortChatIds,
} from '../../modules/helpers';
import searchWords from '../../util/searchWords';
import { pick } from '../../util/iteratees';
import useInfiniteScroll from '../../hooks/useInfiniteScroll';
import useLang from '../../hooks/useLang';

import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import InputText from '../ui/InputText';
import Button from '../ui/Button';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem from '../ui/ListItem';
import PrivateChatInfo from '../common/PrivateChatInfo';
import GroupChatInfo from '../common/GroupChatInfo';

import './ForwardPicker.scss';

export type OwnProps = {
  isOpen: boolean;
};

type StateProps = {
  chatsById: Record<number, ApiChat>;
  activeListIds?: number[];
  archivedListIds?: number[];
  orderedPinnedIds?: number[];
  currentUserId?: number;
};

type DispatchProps = Pick<GlobalActions, 'setForwardChatId' | 'exitForwardMode' | 'loadMoreChats'>;

// Focus slows down animation, also it breaks transition layout in Chrome
const FOCUS_DELAY_MS = 500;
const MODAL_HIDE_DELAY_MS = 300;

const ForwardPicker: FC<OwnProps & StateProps & DispatchProps> = ({
  chatsById,
  activeListIds,
  archivedListIds,
  currentUserId,
  isOpen,
  setForwardChatId,
  exitForwardMode,
  loadMoreChats,
}) => {
  const [filter, setFilter] = useState('');
  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (!IS_MOBILE_SCREEN) {
        setTimeout(() => {
          requestAnimationFrame(() => {
            if (inputRef.current) {
              inputRef.current.focus();
            }
          });
        }, FOCUS_DELAY_MS);
      }
    } else {
      if (inputRef.current) {
        inputRef.current.blur();
      }

      setTimeout(() => {
        setFilter('');
      }, MODAL_HIDE_DELAY_MS);
    }
  }, [isOpen]);

  const chatIds = useMemo(() => {
    const listIds = [
      ...activeListIds || [],
      ...archivedListIds || [],
    ];

    return sortChatIds([
      ...listIds.filter((id) => {
        const chat = chatsById[id];
        if (!chat) {
          return true;
        }

        if (!getCanPostInChat(chat, MAIN_THREAD_ID)) {
          return false;
        }

        if (!filter) {
          return true;
        }

        return searchWords(getChatTitle(chatsById[id], undefined, id === currentUserId), filter);
      }),
    ], chatsById, undefined, currentUserId ? [currentUserId] : undefined);
  }, [activeListIds, archivedListIds, chatsById, currentUserId, filter]);

  const [viewportIds, getMore] = useInfiniteScroll(loadMoreChats, chatIds, Boolean(filter));

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.currentTarget.value);
  }, []);

  const lang = useLang();

  const modalHeader = (
    <div className="modal-header">
      <Button
        round
        color="translucent"
        size="smaller"
        ariaLabel={lang('Close')}
        onClick={exitForwardMode}
      >
        <i className="icon-close" />
      </Button>
      <InputText
        ref={inputRef}
        value={filter}
        onChange={handleFilterChange}
        placeholder={lang('ForwardTo')}
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={exitForwardMode}
      className="ForwardPicker"
      header={modalHeader}
    >
      {viewportIds && viewportIds.length ? (
        <InfiniteScroll
          className="picker-list custom-scroll"
          items={viewportIds}
          onLoadMore={getMore}
          isDisabled={Boolean(filter)}
        >
          {viewportIds.map((id) => (
            <ListItem
              key={id}
              className="chat-item-clickable force-rounded-corners"
              onClick={() => setForwardChatId({ id })}
            >
              {isChatPrivate(id) ? (
                <PrivateChatInfo status={id === currentUserId ? lang('SavedMessagesInfo') : undefined} userId={id} />
              ) : (
                <GroupChatInfo chatId={id} />
              )}
            </ListItem>
          ))}
        </InfiniteScroll>
      ) : viewportIds && !viewportIds.length ? (
        <p className="no-results">Sorry, nothing found.</p>
      ) : (
        <Loading />
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chats: {
        byId: chatsById,
        listIds,
      },
      currentUserId,
    } = global;

    return {
      chatsById,
      activeListIds: listIds.active,
      archivedListIds: listIds.archived,
      currentUserId,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['setForwardChatId', 'exitForwardMode', 'loadMoreChats']),
)(ForwardPicker));
