import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../../global';

import { ManagementScreens } from '../../../types';
import { ApiChat, ApiChatMember } from '../../../api/types';

import { getUserFullName, isChatChannel } from '../../../global/helpers';
import { selectChat } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';
import FloatingActionButton from '../../ui/FloatingActionButton';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat: ApiChat;
  currentUserId?: string;
  isChannel: boolean;
};

const ManageChatAdministrators: FC<OwnProps & StateProps> = ({
  chat,
  isChannel,
  currentUserId,
  onScreenSelect,
  onChatMemberSelect,
  onClose,
  isActive,
}) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleRecentActionsClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupRecentActions);
  }, [onScreenSelect]);

  const adminMembers = useMemo(() => {
    if (!chat.fullInfo || !chat.fullInfo.adminMembers) {
      return [];
    }

    return chat.fullInfo.adminMembers.sort((a, b) => {
      if (a.isOwner) {
        return -1;
      } else if (b.isOwner) {
        return 1;
      }

      return 0;
    });
  }, [chat]);

  const handleAdminMemberClick = useCallback((member: ApiChatMember) => {
    onChatMemberSelect(member.userId, member.promotedByUserId === currentUserId);
    onScreenSelect(ManagementScreens.ChatAdminRights);
  }, [currentUserId, onChatMemberSelect, onScreenSelect]);

  const handleAddAdminClick = useCallback(() => {
    onScreenSelect(ManagementScreens.GroupAddAdmins);
  }, [onScreenSelect]);

  const getMemberStatus = useCallback((member: ApiChatMember) => {
    if (member.isOwner) {
      return lang('ChannelCreator');
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const promotedByUser = member.promotedByUserId ? usersById[member.promotedByUserId] : undefined;

    if (promotedByUser) {
      return lang('EditAdminPromotedBy', getUserFullName(promotedByUser));
    }

    return lang('ChannelAdmin');
  }, [lang]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <ListItem
            icon="recent"
            multiline
            onClick={handleRecentActionsClick}
          >
            <span className="title">{lang('EventLog')}</span>
            <span className="subtitle">{lang(isChannel ? 'EventLogInfoDetailChannel' : 'EventLogInfoDetail')}</span>
          </ListItem>
        </div>

        <div className="section" dir={lang.isRtl ? 'rtl' : undefined}>
          <p className="text-muted" dir="auto">
            {isChannel
              ? 'You can add administrators to help you manage your channel.'
              : 'You can add administrators to help you manage your group.'}
          </p>

          {adminMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleAdminMemberClick(member)}
            >
              <PrivateChatInfo
                userId={member.userId}
                status={getMemberStatus(member)}
                forceShowSelf
              />
            </ListItem>
          ))}

          <FloatingActionButton
            isShown
            onClick={handleAddAdminClick}
            ariaLabel={lang('Channel.Management.AddModerator')}
          >
            <i className="icon-add-user-filled" />
          </FloatingActionButton>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;

    return {
      chat,
      currentUserId: global.currentUserId,
      isChannel: isChatChannel(chat),
    };
  },
)(ManageChatAdministrators));
