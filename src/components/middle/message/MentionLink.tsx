import React, { FC } from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiChat, ApiUser } from '../../../api/types';

import { selectUser } from '../../../modules/selectors';

type OwnProps = {
  userId?: string;
  username?: string;
  children: React.ReactNode;
};

type StateProps = {
  userOrChat?: ApiUser | ApiChat;
};

const MentionLink: FC<OwnProps & StateProps> = ({
  username,
  userOrChat,
  children,
}) => {
  const {
    openChat,
    openChatByUsername,
  } = getDispatch();

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
)(MentionLink);
