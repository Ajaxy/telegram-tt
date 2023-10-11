import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiPeer } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  sender?: ApiPeer;
  children: React.ReactNode;
};

const UserLink: FC<OwnProps> = ({
  className, sender, children,
}) => {
  const { openChat } = getActions();

  const handleClick = useCallback(() => {
    if (sender) {
      openChat({ id: sender.id });
    }
  }, [sender, openChat]);

  if (!sender) {
    return children;
  }

  return (
    <Link className={buildClassName('UserLink', className)} onClick={handleClick}>{children}</Link>
  );
};

export default UserLink;
