import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../modules';

import { ApiChat, ApiChatMember, ApiUser } from '../../../api/types';

import { selectChat } from '../../../modules/selectors';
import { getHasAdminRight, getUserFullName, isChatChannel } from '../../../modules/helpers';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useFlag from '../../../hooks/useFlag';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import FloatingActionButton from '../../ui/FloatingActionButton';
import RemoveGroupUserModal from './RemoveGroupUserModal';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
  usersById: Record<string, ApiUser>;
  canDeleteMembers?: boolean;
  isChannel?: boolean;
};

const ManageChatRemovedUsers: FC<OwnProps & StateProps> = ({
  chat,
  usersById,
  canDeleteMembers,
  isChannel,
  onClose,
  isActive,
}) => {
  const { updateChatMemberBannedRights } = getActions();

  const lang = useLang();
  const [isRemoveUserModalOpen, openRemoveUserModal, closeRemoveUserModal] = useFlag();

  useHistoryBack(isActive, onClose);

  const removedMembers = useMemo(() => {
    if (!chat || !chat.fullInfo || !chat.fullInfo.kickedMembers) {
      return [];
    }

    return chat.fullInfo.kickedMembers;
  }, [chat]);

  const getRemovedBy = useCallback((member: ApiChatMember) => {
    if (!member.kickedByUserId) {
      return undefined;
    }

    const kickedByUser = usersById[member.kickedByUserId];
    if (!kickedByUser) {
      return undefined;
    }

    return lang('UserRemovedBy', getUserFullName(kickedByUser));
  }, [lang, usersById]);

  const getContextActions = useCallback((member: ApiChatMember) => {
    if (!chat) {
      return undefined;
    }

    return [{
      title: lang('Unblock'),
      icon: 'delete',
      destructive: true,
      handler: () => updateChatMemberBannedRights({
        chatId: chat.id,
        userId: member.userId,
        bannedRights: {},
      }),
    }];
  }, [lang, chat, updateChatMemberBannedRights]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section" dir={lang.isRtl ? 'rtl' : undefined}>
          <p className="text-muted">{lang(isChannel ? 'NoBlockedChannel2' : 'NoBlockedGroup2')}</p>

          {removedMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable"
              ripple
              contextActions={getContextActions(member)}
            >
              <PrivateChatInfo
                userId={member.userId}
                status={getRemovedBy(member)}
              />
            </ListItem>
          ))}
          {canDeleteMembers && (
            <FloatingActionButton
              isShown
              onClick={openRemoveUserModal}
              ariaLabel={lang('Channel.EditAdmin.Permission.BanUsers')}
            >
              <i className="icon-add-user-filled" />
            </FloatingActionButton>
          )}
          {chat && canDeleteMembers && (
            <RemoveGroupUserModal
              chat={chat}
              isOpen={isRemoveUserModalOpen}
              onClose={closeRemoveUserModal}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { byId: usersById } = global.users;
    const canDeleteMembers = chat && (getHasAdminRight(chat, 'banUsers') || chat.isCreator);

    return {
      chat,
      usersById,
      canDeleteMembers,
      isChannel: chat && isChatChannel(chat),
    };
  },
)(ManageChatRemovedUsers));
