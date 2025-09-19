import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiTypingStatus, ApiUser } from '../../api/types';

import { getUserFirstOrLastName } from '../../global/helpers';
import { selectUser } from '../../global/selectors';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import DotAnimation from './DotAnimation';

import './TypingStatus.scss';

type OwnProps = {
  typingStatus: ApiTypingStatus;
};

type StateProps = {
  typingUser?: ApiUser;
};

const TypingStatus: FC<OwnProps & StateProps> = ({ typingStatus, typingUser }) => {
  const lang = useOldLang();
  const typingUserName = typingUser && !typingUser.isSelf && getUserFirstOrLastName(typingUser);
  const content = lang(typingStatus.action)
    // Fix for translation "{user} is typing"
    .replace('{user}', '')
    .replace('{emoji}', typingStatus.emoji || '').trim();

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
  (global, { typingStatus }): Complete<StateProps> => {
    if (!typingStatus.userId) {
      return { typingUser: undefined };
    }

    const typingUser = selectUser(global, typingStatus.userId);

    return { typingUser };
  },
)(TypingStatus));
