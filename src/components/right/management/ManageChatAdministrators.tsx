import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ManagementScreens } from '../../../types';
import { ApiChat, ApiChatMember, ApiUser } from '../../../api/types';
import { getUserFullName, isChatChannel } from '../../../modules/helpers';

import { selectChat } from '../../../modules/selectors';
import useLang from '../../../hooks/useLang';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';

type OwnProps = {
  chatId: number;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: number, isPromotedByCurrentUser?: boolean) => void;
};

type StateProps = {
  chat: ApiChat;
  currentUserId?: number;
  isChannel: boolean;
  usersById: Record<number, ApiUser>;
};

const ManageChatAdministrators: FC<OwnProps & StateProps> = ({
  chat,
  isChannel,
  currentUserId,
  usersById,
  onScreenSelect,
  onChatMemberSelect,
}) => {
  const lang = useLang();

  function handleRecentActionsClick() {
    onScreenSelect(ManagementScreens.GroupRecentActions);
  }

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

  const getMemberStatus = useCallback((member: ApiChatMember) => {
    if (member.isOwner) {
      return lang('ChannelCreator');
    }

    const promotedByUser = member.promotedByUserId ? usersById[member.promotedByUserId] : undefined;

    if (promotedByUser) {
      return lang('EditAdminPromotedBy', getUserFullName(promotedByUser));
    }

    return lang('ChannelAdmin');
  }, [lang, usersById]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section">
          <ListItem icon="recent" ripple onClick={handleRecentActionsClick}>
            <div className="multiline-item">
              <span className="title">{lang('EventLog')}</span>
              <span className="subtitle">{lang(isChannel ? 'EventLogInfoDetailChannel' : 'EventLogInfoDetail')}</span>
            </div>
          </ListItem>
        </div>

        <div className="section">
          <p className="text-muted">
            {isChannel
              ? 'You can add administrators to help you manage your channel.'
              : 'You can add administrators to help you manage your group.'}
          </p>

          {adminMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable"
              ripple
              onClick={() => handleAdminMemberClick(member)}
            >
              <PrivateChatInfo
                userId={member.userId}
                status={getMemberStatus(member)}
                forceShowSelf
              />
            </ListItem>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId)!;
    const { byId: usersById } = global.users;

    return {
      chat,
      currentUserId: global.currentUserId,
      isChannel: isChatChannel(chat),
      usersById,
    };
  },
  // (setGlobal, actions): DispatchProps => pick(actions, ['togglePreHistoryHidden', 'updateChat']),
)(ManageChatAdministrators));
