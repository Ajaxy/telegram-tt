import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { getUserFullName } from '../../../global/helpers';
import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectTabState } from '../../../global/selectors';
import { unique } from '../../../util/iteratees';

import useOldLang from '../../../hooks/useOldLang';

import ChatOrUserPicker from '../../common/pickers/ChatOrUserPicker';

export type OwnProps = {
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  blockedIds: string[];
  contactIds?: string[];
  localContactIds?: string[];
  currentUserId?: string;
};

const BlockUserModal: FC<OwnProps & StateProps> = ({
  usersById,
  blockedIds,
  contactIds,
  localContactIds,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const {
    setUserSearchQuery,
    blockUser,
  } = getActions();

  const lang = useOldLang();
  const [search, setSearch] = useState('');

  useEffect(() => {
    setUserSearchQuery({ query: search });
  }, [search, setUserSearchQuery]);

  const filteredContactIds = useMemo(() => {
    const availableContactIds = unique([
      ...(contactIds || []),
      ...(localContactIds || []),
    ].filter((contactId) => {
      return contactId !== currentUserId && !blockedIds.includes(contactId);
    }));

    return filterPeersByQuery({ ids: availableContactIds, query: search, type: 'user' })
      .sort((firstId, secondId) => {
        const firstName = getUserFullName(usersById[firstId]) || '';
        const secondName = getUserFullName(usersById[secondId]) || '';

        return firstName.localeCompare(secondName);
      });
  }, [blockedIds, contactIds, currentUserId, search, localContactIds, usersById]);

  const handleRemoveUser = useCallback((userId: string) => {
    blockUser({ userId });
    onClose();
  }, [onClose]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      chatOrUserIds={filteredContactIds}
      searchPlaceholder={lang('BlockedUsers.BlockUser')}
      search={search}
      onSearchChange={setSearch}
      onSelectChatOrUser={handleRemoveUser}
      onClose={onClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
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
      localContactIds: selectTabState(global).userSearch.localUserIds,
      currentUserId,
    };
  },
)(BlockUserModal));
