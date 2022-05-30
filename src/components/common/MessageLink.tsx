import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  message?: ApiMessage;
  children: React.ReactNode;
};

const MessageLink: FC<OwnProps> = ({
  className, message, children,
}) => {
  const { focusMessage } = getActions();

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

export default MessageLink;
