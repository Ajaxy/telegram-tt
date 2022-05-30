import type { FC } from '../../../lib/teact/teact';
import React, {
  useMemo, useState, memo, useRef, useCallback, useEffect,
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
  const [filter, setFilter] = useState('');
  // eslint-disable-next-line no-null/no-null
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserSearchQuery({ query: filter });
  }, [filter, setUserSearchQuery]);

  const filteredContactIds = useMemo(() => {
    const availableContactIds = unique([
      ...(contactIds || []),
      ...(localContactIds || []),
    ].filter((contactId) => {
      return contactId !== currentUserId && !blockedIds.includes(contactId);
    }));

    return filterUsersByName(availableContactIds, usersById, filter)
      .sort((firstId, secondId) => {
        const firstName = getUserFullName(usersById[firstId]) || '';
        const secondName = getUserFullName(usersById[secondId]) || '';

        return firstName.localeCompare(secondName);
      });
  }, [blockedIds, contactIds, currentUserId, filter, localContactIds, usersById]);

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
      filterRef={filterRef}
      filterPlaceholder={lang('BlockedUsers.BlockUser')}
      filter={filter}
      onFilterChange={setFilter}
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
