import type { FC } from '../../../lib/teact/teact';
import React, {
  useMemo, useState, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { filterUsersByName, getUserFullName } from '../../../global/helpers';
import { unique } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';

import ChatOrUserPicker from '../../common/ChatOrUserPicker';

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
    blockContact,
  } = getActions();

  const lang = useLang();
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

    return filterUsersByName(availableContactIds, usersById, search)
      .sort((firstId, secondId) => {
        const firstName = getUserFullName(usersById[firstId]) || '';
        const secondName = getUserFullName(usersById[secondId]) || '';

        return firstName.localeCompare(secondName);
      });
  }, [blockedIds, contactIds, currentUserId, search, localContactIds, usersById]);

  const handleRemoveUser = useCallback((userId: string) => {
    const { id: contactId, accessHash } = usersById[userId] || {};
    if (!contactId || !accessHash) {
      return;
    }
    blockContact({ contactId, accessHash });
    onClose();
  }, [blockContact, onClose, usersById]);

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
      localContactIds: global.userSearch.localUserIds,
      currentUserId,
    };
  },
)(BlockUserModal));
