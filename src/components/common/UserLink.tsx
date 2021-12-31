import React, { FC, useCallback } from '../../lib/teact/teact';

import { ApiChat, ApiUser } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';
import { getDispatch } from '../../lib/teact/teactn';

type OwnProps = {
  className?: string;
  sender?: ApiUser | ApiChat;
  children: any;
};

const UserLink: FC<OwnProps> = ({
  className, sender, children,
}) => {
  const { openUserInfo } = getDispatch();

  const handleClick = useCallback(() => {
    if (sender) {
      openUserInfo({ id: sender.id });
    }
  }, [sender, openUserInfo]);

  if (!sender) {
    return children;
  }

  return (
    <Link className={buildClassName('UserLink', className)} onClick={handleClick}>{children}</Link>
  );
};

export default UserLink;
