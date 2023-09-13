import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  chatId?: string;
  children: React.ReactNode;
};

const ChatLink: FC<OwnProps> = ({
  className, chatId, children,
}) => {
  const { openChat } = getActions();

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

export default memo(ChatLink);
