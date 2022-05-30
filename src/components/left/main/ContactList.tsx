import type { FC } from '../../../lib/teact/teact';
import React, { useCallback, useMemo, memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiUserStatus } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import { filterUsersByName, sortUserIds } from '../../../global/helpers';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';
import FloatingActionButton from '../../ui/FloatingActionButton';

export type OwnProps = {
  filter: string;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  contactIds?: string[];
  serverTimeOffset: number;
};

const ContactList: FC<OwnProps & StateProps> = ({
  isActive,
  filter,
  usersById,
  userStatusesById,
  contactIds,
  serverTimeOffset,
  onReset,
}) => {
  const {
    openChat,
    openNewContactDialog,
  } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleClick = useCallback((id: string) => {
    openChat({ id, shouldReplaceHistory: true });
  }, [openChat]);

  const listIds = useMemo(() => {
    if (!contactIds) {
      return undefined;
    }

    const filteredIds = filterUsersByName(contactIds, usersById, filter);

    return sortUserIds(filteredIds, usersById, userStatusesById, undefined, serverTimeOffset);
  }, [contactIds, filter, usersById, userStatusesById, serverTimeOffset]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, listIds, Boolean(filter));

  return (
    <InfiniteScroll items={viewportIds} onLoadMore={getMore} className="chat-list custom-scroll">
      {viewportIds?.length ? (
        viewportIds.map((id) => (
          <ListItem
            key={id}
            className="chat-item-clickable"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => handleClick(id)}
            ripple={!IS_SINGLE_COLUMN_LAYOUT}
          >
            <PrivateChatInfo userId={id} forceShowSelf avatarSize="large" />
          </ListItem>
        ))
      ) : viewportIds && !viewportIds.length ? (
        <p className="no-results" key="no-results" dir="auto">
          {filter.length ? 'No contacts matched your search.' : 'Contact list is empty.'}
        </p>
      ) : (
        <Loading key="loading" />
      )}
      <FloatingActionButton
        isShown
        onClick={openNewContactDialog}
        ariaLabel={lang('CreateNewContact')}
      >
        <i className="icon-add-user-filled" />
      </FloatingActionButton>
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { userIds: contactIds } = global.contactList || {};
    const { byId: usersById, statusesById: userStatusesById } = global.users;

    return {
      usersById,
      userStatusesById,
      contactIds,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ContactList));
