import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getDispatch, getGlobal, withGlobal } from '../../../lib/teact/teactn';

import { ApiChatMember, ApiUserStatus } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat } from '../../../modules/selectors';
import { sortUserIds, isChatChannel } from '../../../modules/helpers';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import NothingFound from '../../common/NothingFound';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
  isActive: boolean;
  noAdmins?: boolean;
  onClose: NoneToVoidFunction;
  onScreenSelect?: (screen: ManagementScreens) => void;
  onChatMemberSelect?: (memberId: string, isPromotedByCurrentUser?: boolean) => void;
};

type StateProps = {
  userStatusesById: Record<string, ApiUserStatus>;
  members?: ApiChatMember[];
  adminMembers?: ApiChatMember[];
  isChannel?: boolean;
  serverTimeOffset: number;
};

const ManageGroupMembers: FC<OwnProps & StateProps> = ({
  noAdmins,
  members,
  adminMembers,
  userStatusesById,
  isChannel,
  isActive,
  serverTimeOffset,
  onClose,
  onScreenSelect,
  onChatMemberSelect,
}) => {
  const { openUserInfo } = getDispatch();

  const memberIds = useMemo(() => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    if (!members || !usersById) {
      return undefined;
    }
    const adminIds = noAdmins ? adminMembers?.map(({ userId }) => userId) || [] : [];

    const userIds = sortUserIds(
      members.map(({ userId }) => userId),
      usersById,
      userStatusesById,
      undefined,
      serverTimeOffset,
    );

    return noAdmins ? userIds.filter((userId) => !adminIds.includes(userId)) : userIds;
  }, [members, noAdmins, adminMembers, userStatusesById, serverTimeOffset]);

  const handleMemberClick = useCallback((id: string) => {
    if (noAdmins) {
      onChatMemberSelect!(id, false);
      onScreenSelect!(ManagementScreens.ChatNewAdminRights);
    } else {
      openUserInfo({ id });
    }
  }, [noAdmins, onChatMemberSelect, onScreenSelect, openUserInfo]);

  useHistoryBack(isActive, onClose);

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
                onClick={() => handleMemberClick(id)}
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
    const { statusesById: userStatusesById } = global.users;
    const members = chat?.fullInfo?.members;
    const adminMembers = chat?.fullInfo?.adminMembers;
    const isChannel = chat && isChatChannel(chat);

    return {
      members,
      adminMembers,
      userStatusesById,
      isChannel,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageGroupMembers));
