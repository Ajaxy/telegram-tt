import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiTypingStatus } from '../../api/types';

import { selectUser } from '../../modules/selectors';
import { getUserFirstOrLastName } from '../../modules/helpers';
import renderText from './helpers/renderText';

import './TypingStatus.scss';

type OwnProps = {
  typingStatus: ApiTypingStatus;
};

type StateProps = {
  typingUser?: ApiUser;
};

const TypingStatus: FC<OwnProps & StateProps> = ({ typingStatus, typingUser }) => {
  const typingUserName = typingUser && !typingUser.isSelf && getUserFirstOrLastName(typingUser);

  return (
    <p className="typing-status">
      {typingUserName && (
        <span className="sender-name" dir="auto">{renderText(typingUserName)}</span>
      )}
      {typingStatus.action}
      <span className="ellipsis" />
    </p>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { typingStatus }): StateProps => {
    if (!typingStatus.userId) {
      return {};
    }

    const typingUser = selectUser(global, typingStatus.userId);

    return { typingUser };
  },
)(TypingStatus));
