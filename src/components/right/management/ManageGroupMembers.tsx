import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChatMember, ApiUser } from '../../../api/types';
import { GlobalActions } from '../../../global/types';
import { selectChat } from '../../../modules/selectors';
import { getSortedUserIds, isChatChannel } from '../../../modules/helpers';
import { pick } from '../../../util/iteratees';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import NothingFound from '../../common/NothingFound';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: number;
};

type StateProps = {
  usersById: Record<number, ApiUser>;
  members?: ApiChatMember[];
  isChannel?: boolean;
};

type DispatchProps = Pick<GlobalActions, 'openUserInfo'>;

const ManageGroupMembers: FC<OwnProps & StateProps & DispatchProps> = ({
  members,
  usersById,
  isChannel,
  openUserInfo,
}) => {
  const memberIds = useMemo(() => {
    if (!members || !usersById) {
      return undefined;
    }

    return getSortedUserIds(members.map(({ userId }) => userId), usersById);
  }, [members, usersById]);

  const handleMemberClick = useCallback((id: number) => {
    openUserInfo({ id });
  }, [openUserInfo]);

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
    const { byId: usersById } = global.users;
    const members = chat && chat.fullInfo && chat.fullInfo.members;
    const isChannel = chat && isChatChannel(chat);

    return {
      members,
      usersById,
      isChannel,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openUserInfo',
  ]),
)(ManageGroupMembers));
