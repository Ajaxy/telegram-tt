import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChatMember, ApiUser } from '../../../api/types';
import { ManagementScreens } from '../../../types';

import { selectChat } from '../../../modules/selectors';
import { sortUserIds, isChatChannel } from '../../../modules/helpers';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';
import NothingFound from '../../common/NothingFound';

type OwnProps = {
  chatId: number;
  onScreenSelect: (screen: ManagementScreens) => void;
  onChatMemberSelect: (memberId: number) => void;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  members?: ApiChatMember[];
  isChannel?: boolean;
  serverTimeOffset: number;
};

const ManageGroupUserPermissionsCreate: FC<OwnProps & StateProps> = ({
  usersById,
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
      usersById, undefined, serverTimeOffset,
    );
  }, [members, serverTimeOffset, usersById]);

  const handleExceptionMemberClick = useCallback((memberId: number) => {
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
    const { byId: usersById } = global.users;
    const members = chat?.fullInfo?.members;
    const isChannel = chat && isChatChannel(chat);

    return {
      members,
      usersById,
      isChannel,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
)(ManageGroupUserPermissionsCreate));
