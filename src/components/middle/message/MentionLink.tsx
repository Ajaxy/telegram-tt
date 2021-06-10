import React, { FC } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiChat, ApiUser } from '../../../api/types';

import { pick } from '../../../util/iteratees';
import { selectUser } from '../../../modules/selectors';

type OwnProps = {
  userId?: number;
  username?: string;
  children: any;
};

type StateProps = {
  userOrChat?: ApiUser | ApiChat;
};

type DispatchProps = Pick<GlobalActions, 'openChat' | 'openChatByUsername'>;

const MentionLink: FC<OwnProps & StateProps & DispatchProps> = ({
  username,
  userOrChat,
  children,
  openChat,
  openChatByUsername,
}) => {
  const handleClick = () => {
    if (userOrChat) {
      openChat({ id: userOrChat.id });
    } else if (username) {
      openChatByUsername({ username: username.substring(1) });
    }
  };

  return (
    <a onClick={handleClick} className="text-entity-link" dir="auto">
      {children}
    </a>
  );
};

export default withGlobal<OwnProps>(
  (global, { userId }): StateProps => {
    return {
      userOrChat: userId ? selectUser(global, userId) : undefined,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['openChat', 'openChatByUsername']),
)(MentionLink);
