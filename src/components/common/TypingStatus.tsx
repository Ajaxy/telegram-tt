import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiUser, ApiTypingStatus } from '../../api/types';

import { selectUser } from '../../global/selectors';
import { getUserFirstOrLastName } from '../../global/helpers';
import renderText from './helpers/renderText';
import useLang from '../../hooks/useLang';

import DotAnimation from './DotAnimation';

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
  const content = lang(typingStatus.action)
    // Fix for translation "{user} is typing"
    .replace('{user}', '')
    .replace('{emoji}', typingStatus.emoji).trim();

  return (
    <p className="typing-status" dir={lang.isRtl ? 'rtl' : 'auto'}>
      {typingUserName && (
        <span className="sender-name" dir="auto">{renderText(typingUserName)}</span>
      )}
      <DotAnimation content={content} />
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
