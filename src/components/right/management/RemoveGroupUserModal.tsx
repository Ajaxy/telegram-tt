import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback,
  useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiChatMember } from '../../../api/types';

import { filterPeersByQuery } from '../../../global/helpers/peers';
import { selectChatFullInfo } from '../../../global/selectors';

import useOldLang from '../../../hooks/useOldLang';

import ChatOrUserPicker from '../../common/pickers/ChatOrUserPicker';

export type OwnProps = {
  chat: ApiChat;
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  currentUserId?: string;
  chatMembers?: ApiChatMember[];
};

const RemoveGroupUserModal: FC<OwnProps & StateProps> = ({
  chat,
  currentUserId,
  chatMembers,
  isOpen,
  onClose,
}) => {
  const {
    loadMoreMembers,
    deleteChatMember,
  } = getActions();

  const lang = useOldLang();
  const [search, setSearch] = useState('');

  const usersId = useMemo(() => {
    const availableMemberIds = (chatMembers || [])
      .reduce((acc: string[], member) => {
        if (!member.isAdmin && !member.isOwner && member.userId !== currentUserId) {
          acc.push(member.userId);
        }
        return acc;
      }, []);

    return filterPeersByQuery({ ids: availableMemberIds, query: search, type: 'user' });
  }, [chatMembers, currentUserId, search]);

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
  (global, { chat }): StateProps => {
    const { currentUserId } = global;

    return {
      currentUserId,
      chatMembers: selectChatFullInfo(global, chat.id)?.members,
    };
  },
)(RemoveGroupUserModal));
