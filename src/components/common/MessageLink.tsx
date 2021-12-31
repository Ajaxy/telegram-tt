import React, { FC, useCallback } from '../../lib/teact/teact';
import { getDispatch } from '../../lib/teact/teactn';

import { ApiMessage } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  message?: ApiMessage;
  children: any;
};

const MessageLink: FC<OwnProps> = ({
  className, message, children,
}) => {
  const { focusMessage } = getDispatch();

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
