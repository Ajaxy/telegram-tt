import type { TeactNode } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';

import { selectUser } from '../../../global/selectors';

import useAppLayout from '../../../hooks/useAppLayout';

type OwnProps = {
  userId?: string;
  username?: string;
  children: TeactNode;
};

type StateProps = {
  userOrChat?: ApiPeer;
};

const MentionLink = ({
  userId,
  username,
  userOrChat,
  children,
}: OwnProps & StateProps) => {
  const {
    openChat,
    openChatByUsername,
    closeStoryViewer,
    setShouldCloseRightColumn,
  } = getActions();

  const { isMobile } = useAppLayout();

  const handleClick = () => {
    if (isMobile) {
      setShouldCloseRightColumn({
        value: true,
      });
    }

    if (userOrChat) {
      openChat({ id: userOrChat.id });
    } else if (username) {
      closeStoryViewer();
      openChatByUsername({ username: username.substring(1) });
    }
  };

  return (
    <a
      onClick={handleClick}
      className="text-entity-link"
      dir="auto"
      data-entity-type={userId ? ApiMessageEntityTypes.MentionName : ApiMessageEntityTypes.Mention}
    >
      {children}
    </a>
  );
};

export default withGlobal<OwnProps>(
  (global, { userId }): Complete<StateProps> => {
    return {
      userOrChat: userId ? selectUser(global, userId) : undefined,
    };
  },
)(MentionLink);
