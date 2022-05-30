import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useMemo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat, ApiChatMember } from '../../../api/types';
import useLang from '../../../hooks/useLang';
import { selectChat } from '../../../global/selectors';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';
import PrivateChatInfo from '../../common/PrivateChatInfo';

type OwnProps = {
  chatId: string;
  onClose: NoneToVoidFunction;
  isActive: boolean;
};

type StateProps = {
  chat?: ApiChat;
};

const ManageGroupRecentActions: FC<OwnProps & StateProps> = ({ chat, onClose, isActive }) => {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const adminMembers = useMemo(() => {
    if (!chat || !chat.fullInfo || !chat.fullInfo.adminMembers) {
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

  const getMemberStatus = useCallback((member: ApiChatMember) => {
    if (member.isOwner) {
      return lang('ChannelCreator');
    }

    return lang('ChannelAdmin');
  }, [lang]);

  return (
    <div className="Management">
      <div className="custom-scroll">
        <div className="section not-implemented" dir={lang.isRtl ? 'rtl' : undefined}>
          <h3 className="section-heading" dir="auto">Actions</h3>

          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogAllEvents')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterNewAdmins')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterNewMembers')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterChannelInfo')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterDeletedMessages')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterEditedMessages')}
              onChange={undefined}
            />
          </div>
          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogFilterLeavingMembers')}
              onChange={undefined}
            />
          </div>
        </div>

        <div className="section not-implemented" dir={lang.isRtl ? 'rtl' : undefined}>
          <h3 className="section-heading" dir="auto">{lang('Channel.Management.Title')}</h3>

          <div className="ListItem no-selection">
            <Checkbox
              name="changeInfo"
              checked={!false}
              label={lang('EventLogAllAdmins')}
              onChange={undefined}
            />
          </div>

          {adminMembers.map((member) => (
            <ListItem
              key={member.userId}
              className="chat-item-clickable picker-list-item"
              onClick={undefined}
              ripple
            >
              <Checkbox label="" checked={!false} />
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
    const chat = selectChat(global, chatId);

    return { chat };
  },
)(ManageGroupRecentActions));
