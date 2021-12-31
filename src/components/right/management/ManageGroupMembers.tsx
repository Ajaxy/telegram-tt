import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChatMember, ApiUser, ApiUserStatus } from '../../../api/types';
import { selectChat } from '../../../modules/selectors';
import { sortUserIds, isChatChannel } from '../../../modules/helpers';
import useHistoryBack from '../../../hooks/useHistoryBack';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import NothingFound from '../../common/NothingFound';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: string;
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

const ManageGroupMembers: FC<OwnProps & StateProps> = ({
  members,
  usersById,
  userStatusesById,
  isChannel,
  onClose,
  isActive,
  serverTimeOffset,
}) => {
  const { openUserInfo } = getDispatch();

  const memberIds = useMemo(() => {
    if (!members || !usersById) {
      return undefined;
    }

    return sortUserIds(
      members.map(({ userId }) => userId),
      usersById,
      userStatusesById,
      undefined,
      serverTimeOffset,
    );
  }, [members, serverTimeOffset, usersById, userStatusesById]);

  const handleMemberClick = useCallback((id: string) => {
    openUserInfo({ id });
  }, [openUserInfo]);

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
)(ManageGroupMembers));
