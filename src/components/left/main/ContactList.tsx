import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser, ApiUserStatus } from '../../../api/types';
import { StoryViewerOrigin } from '../../../types';

import { sortUserIds } from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';

import useAppLayout from '../../../hooks/useAppLayout';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useOldLang from '../../../hooks/useOldLang';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import FloatingActionButton from '../../ui/FloatingActionButton';
import InfiniteScroll from '../../ui/InfiniteScroll';
import ListItem from '../../ui/ListItem';
import Loading from '../../ui/Loading';

export type OwnProps = {
  filter: string;
  isActive: boolean;
  onReset: () => void;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  contactIds?: string[];
};

const ContactList: FC<OwnProps & StateProps> = ({
  isActive,
  filter,
  usersById,
  userStatusesById,
  contactIds,
  onReset,
}) => {
  const {
    openChat,
    openNewContactDialog,
  } = getActions();

  const lang = useOldLang();
  const { isMobile } = useAppLayout();

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

    const filteredIds = filterPeersByQuery({ ids: contactIds, query: filter, type: 'user' });

    return sortUserIds(filteredIds, usersById, userStatusesById);
  }, [contactIds, filter, usersById, userStatusesById]);

  const [viewportIds, getMore] = useInfiniteScroll(undefined, listIds, Boolean(filter));

  return (
    <InfiniteScroll items={viewportIds} onLoadMore={getMore} className="chat-list custom-scroll">
      {viewportIds?.length ? (
        viewportIds.map((id) => (
          <ListItem
            key={id}
            className="chat-item-clickable contact-list-item"
            onClick={() => handleClick(id)}
          >
            <PrivateChatInfo
              userId={id}
              forceShowSelf
              avatarSize="large"
              withStory
              storyViewerOrigin={StoryViewerOrigin.ChatList}
              ripple={!isMobile}
            />
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
        key="create-new-contact"
        isShown
        onClick={openNewContactDialog}
        ariaLabel={lang('CreateNewContact')}
        iconName="add-user-filled"
      />
    </InfiniteScroll>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { userIds: contactIds } = global.contactList || {};
    const { byId: usersById, statusesById: userStatusesById } = global.users;

    return {
      usersById,
      userStatusesById,
      contactIds,
    };
  },
)(ContactList));
