import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiMessage } from '../../api/types';

import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  message?: ApiMessage;
  children: any;
};

type DispatchProps = Pick<GlobalActions, 'focusMessage'>;

const MessageLink: FC<OwnProps & DispatchProps> = ({
  className, message, children, focusMessage,
}) => {
  const handleMessageClick = useCallback((): void => {
    if (message) {
      focusMessage({ chatId: message.chatId, messageId: message.id });
    }
  }, [focusMessage, message]);

  if (!message) {
    return children;
  }

  return (
    <Link className={buildClassName('MessageLink', className)} onClick={handleMessageClick}>{children}</Link>
  );
};

export default withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['focusMessage']),
)(MessageLink);
