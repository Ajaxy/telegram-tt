import type { FC } from '../../../lib/teact/teact';
import React, {
  useMemo, useState, memo, useCallback,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';

import { filterUsersByName } from '../../../global/helpers';
import useLang from '../../../hooks/useLang';

import ChatOrUserPicker from '../../common/ChatOrUserPicker';

export type OwnProps = {
  chat: ApiChat;
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
};

const RemoveGroupUserModal: FC<OwnProps & StateProps> = ({
  chat,
  currentUserId,
  isOpen,
  onClose,
}) => {
  const {
    loadMoreMembers,
    deleteChatMember,
  } = getActions();

  const lang = useLang();
  const [search, setSearch] = useState('');

  const usersId = useMemo(() => {
    const availableMemberIds = (chat.fullInfo?.members || [])
      .reduce((acc: string[], member) => {
        if (!member.isAdmin && !member.isOwner && member.userId !== currentUserId) {
          acc.push(member.userId);
        }
        return acc;
      }, []);

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

    return filterUsersByName(availableMemberIds, usersById, search);
  }, [chat.fullInfo?.members, currentUserId, search]);

  const handleRemoveUser = useCallback((userId: string) => {
    deleteChatMember({ chatId: chat.id, userId });
    onClose();
  }, [chat.id, deleteChatMember, onClose]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      chatOrUserIds={usersId}
      searchPlaceholder={lang('ChannelBlockUser')}
      search={search}
      onSearchChange={setSearch}
      loadMore={loadMoreMembers}
      onSelectChatOrUser={handleRemoveUser}
      onClose={onClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;

    return { currentUserId };
  },
)(RemoveGroupUserModal));
