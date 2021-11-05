import React, {
  FC, useMemo, useState, memo, useRef, useCallback,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat, ApiUser } from '../../../api/types';

import { getUserFullName } from '../../../modules/helpers';
import searchWords from '../../../util/searchWords';
import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';

import ChatOrUserPicker from '../../common/ChatOrUserPicker';

export type OwnProps = {
  chat: ApiChat;
  isOpen: boolean;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  currentUserId?: string;
};

type DispatchProps = Pick<GlobalActions, 'loadMoreMembers' | 'deleteChatMember'>;

const RemoveGroupUserModal: FC<OwnProps & StateProps & DispatchProps> = ({
  chat,
  usersById,
  currentUserId,
  isOpen,
  onClose,
  loadMoreMembers,
  deleteChatMember,
}) => {
  const lang = useLang();
  const [filter, setFilter] = useState('');
  // eslint-disable-next-line no-null/no-null
  const filterRef = useRef<HTMLInputElement>(null);

  const usersId = useMemo(() => {
    const availableMembers = (chat.fullInfo?.members || []).filter((member) => {
      return !member.isAdmin && !member.isOwner && member.userId !== currentUserId;
    });

    return availableMembers.reduce<string[]>((acc, member) => {
      if (
        !filter
        || !usersById[member.userId]
        || searchWords(getUserFullName(usersById[member.userId]) || '', filter)
      ) {
        acc.push(member.userId);
      }

      return acc;
    }, []);
  }, [chat.fullInfo?.members, currentUserId, filter, usersById]);

  const handleRemoveUser = useCallback((userId: string) => {
    deleteChatMember({ chatId: chat.id, userId });
    onClose();
  }, [chat.id, deleteChatMember, onClose]);

  return (
    <ChatOrUserPicker
      isOpen={isOpen}
      chatOrUserIds={usersId}
      filterRef={filterRef}
      filterPlaceholder={lang('ChannelBlockUser')}
      filter={filter}
      onFilterChange={setFilter}
      loadMore={loadMoreMembers}
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
      currentUserId,
    } = global;

    return { usersById, currentUserId };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['loadMoreMembers', 'deleteChatMember']),
)(RemoveGroupUserModal));
