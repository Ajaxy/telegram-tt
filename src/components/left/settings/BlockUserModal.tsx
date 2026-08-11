import type { FC } from '../../../lib/teact/teact';
import {
  memo, useCallback,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { unique } from '../../../util/iteratees';

import useLang from '../../../hooks/useLang';
import usePeerSearch, { userAccountSearch } from '../../../hooks/usePeerSearch';

import ChatOrUserPicker from '../../common/pickers/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  blockedIds: string[];
  contactIds?: string[];
  currentUserId?: string;
};

const BlockUserModal: FC<OwnProps & StateProps> = ({
  usersById,
  blockedIds,
  contactIds,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const { blockUser } = getActions();

  const lang = useLang();
  const [search, setSearch] = useState('');
  const { result: foundIds, currentResultsQuery } = usePeerSearch({
    query: search,
    queryFn: userAccountSearch,
  });
  const relevantFoundIds = currentResultsQuery === search ? foundIds : undefined;

  const filteredContactIds = useMemo(() => {
    const availableContactIds = unique([
      ...(contactIds || []),
      ...(relevantFoundIds || []),
    ].filter((contactId) => {
      return contactId !== currentUserId && !blockedIds.includes(contactId);
    }));

    return filterPeersByQuery({ ids: availableContactIds, query: search, type: 'user' })
      .sort((firstId, secondId) => {
        const firstName = getUserFullName(usersById[firstId]) || '';
        const secondName = getUserFullName(usersById[secondId]) || '';

        return firstName.localeCompare(secondName);
      });
  }, [blockedIds, contactIds, currentUserId, search, relevantFoundIds, usersById]);

  const handleRemoveUser = useCallback((userId: string) => {
    blockUser({ userId });
    onClose();
  }, [onClose]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      chatOrUserIds={filteredContactIds}
      title={lang('BlockedUsersBlockUser')}
      searchPlaceholder={lang('Search')}
      search={search}
      onSearchChange={setSearch}
      onSelectChatOrUser={handleRemoveUser}
      onClose={onClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      users: {
        byId: usersById,
      },
      blocked: {
        ids: blockedIds,
      },
      contactList,
      currentUserId,
    } = global;

    return {
      usersById,
      blockedIds,
      contactIds: contactList?.userIds,
      currentUserId,
    };
  },
)(BlockUserModal));
