import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiUser, ApiTypingStatus } from '../../api/types';

import { selectUser } from '../../modules/selectors';
import { getUserFirstOrLastName } from '../../modules/helpers';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import './TypingStatus.scss';

type OwnProps = {
  typingStatus: ApiTypingStatus;
};

type StateProps = {
  typingUser?: ApiUser;
};

const TypingStatus: FC<OwnProps & StateProps> = ({ typingStatus, typingUser }) => {
  const lang = useLang();
  const typingUserName = typingUser && !typingUser.isSelf && getUserFirstOrLastName(typingUser);

  return (
    <p className="typing-status" dir={lang.isRtl ? 'rtl' : 'auto'}>
      {typingUserName && (
        <span className="sender-name" dir="auto">{renderText(typingUserName)}</span>
      )}
      {/* fix for translation "username _is_ typing" */}
      {lang(typingStatus.action).replace('{user}', '').replace('{emoji}', typingStatus.emoji).trim()}
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
