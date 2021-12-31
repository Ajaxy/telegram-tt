import React, { FC, useCallback } from '../../lib/teact/teact';
import { getDispatch } from '../../lib/teact/teactn';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  chatId?: string;
  children: any;
};

const ChatLink: FC<OwnProps> = ({
  className, chatId, children,
}) => {
  const { openChat } = getDispatch();

  const handleClick = useCallback(() => {
    if (chatId) {
      openChat({ id: chatId });
    }
  }, [chatId, openChat]);

  if (!chatId) {
    return children;
  }

  return (
    <Link className={buildClassName('ChatLink', className)} onClick={handleClick}>{children}</Link>
  );
};

export default ChatLink;
