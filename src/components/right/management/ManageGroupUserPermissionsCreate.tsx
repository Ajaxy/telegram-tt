import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../modules';

import { ApiChatMember, ApiUser, ApiUserStatus } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat } from '../../../modules/selectors';
import { sortUserIds, isChatChannel } from '../../../modules/helpers';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import NothingFound from '../../common/NothingFound';

type OwnProps = {
  chatId: string;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: string) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  members?: ApiChatMember[];
  isChannel?: boolean;
  serverTimeOffset: number;
};

const ManageGroupUserPermissionsCreate: FC<OwnProps & StateProps> = ({
  usersById,
  userStatusesById,
  members,
  isChannel,
  onScreenSelect,
  onChatMemberSelect,
  onClose,
  isActive,
  serverTimeOffset,
}) => {
  useHistoryBack(isActive, onClose);

  const memberIds = useMemo(() => {
    if (!members || !usersById) {
      return undefined;
    }

    return sortUserIds(
      members.filter((member) => !member.isOwner).map(({ userId }) => userId),
      usersById,
      userStatusesById,
      undefined,
      serverTimeOffset,
    );
  }, [members, serverTimeOffset, usersById, userStatusesById]);

  const handleExceptionMemberClick = useCallback((memberId: string) => {
    onChatMemberSelect(memberId);
    onScreenSelect(ManagementScreens.GroupUserPermissions);
  }, [onChatMemberSelect, onScreenSelect]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section" teactFastList>
          {memberIds ? (
            memberIds.map((id, i) => (
              <ListItem
                key={id}
                teactOrderKey={i}
                className="chat-item-clickable scroll-item"
                onClick={() => handleExceptionMemberClick(id)}
              >
                <PrivateChatInfo userId={id} forceShowSelf />
              </ListItem>
            ))
          ) : (
            <NothingFound
              teactOrderKey={0}
              key="nothing-found"
              text={isChannel ? 'No subscribers found' : 'No members found'}
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
    const { byId: usersById, statusesById: userStatusesById } = global.users;
    const members = chat?.fullInfo?.members;
    const isChannel = chat && isChatChannel(chat);

    return {
      members,
      usersById,
      userStatusesById,
      isChannel,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageGroupUserPermissionsCreate));
