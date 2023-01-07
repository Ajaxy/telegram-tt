import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat } from '../../../api/types';

import { selectIsChatMuted } from '../../../global/helpers';
import {
  selectChat,
  selectNotifySettings,
  selectNotifyExceptions,
  selectIsForumPanelOpen,
} from '../../../global/selectors';

import Badge from './Badge';

type OwnProps = {
  chatId: string;
};

type StateProps = {
  chat?: ApiChat;
  isMuted?: boolean;
  isForumPanelActive?: boolean;
};

const AvatarBadge: FC<OwnProps & StateProps> = ({
  chat,
  isMuted,
  isForumPanelActive,
}) => {
  return chat && (
    <div className="avatar-badge-wrapper">
      <Badge chat={chat} isMuted={isMuted} shouldShowOnlyMostImportant forceHidden={!isForumPanelActive} />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat) {
      return {};
    }

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      isForumPanelActive: selectIsForumPanelOpen(global),
    };
  },
)(AvatarBadge));
