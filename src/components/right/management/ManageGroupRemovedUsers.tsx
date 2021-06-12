import React, {
  FC, memo, useCallback, useMemo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiChatMember, ApiUser } from '../../../api/types';
import { GlobalActions } from '../../../global/types';

import { selectChat } from '../../../modules/selectors';
import { getUserFullName } from '../../../modules/helpers';
import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  chatId: number;
};

type StateProps = {
  chat?: ApiChat;
  usersById: Record<number, ApiUser>;
};

type DispatchProps = Pick<GlobalActions, 'updateChatMemberBannedRights'>;

const ManageGroupRemovedUsers: FC<OwnProps & StateProps & DispatchProps> = ({
  chat,
  usersById,
  updateChatMemberBannedRights,
}) => {
  const lang = useLang();

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
          <p className="text-muted">{lang('NoBlockedGroup2')}</p>

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
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const { byId: usersById } = global.users;

    return { chat, usersById };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['updateChatMemberBannedRights']),
)(ManageGroupRemovedUsers));
