import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat, ApiUser } from '../../api/types';

import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  sender?: ApiUser | ApiChat;
  children: any;
};

type DispatchProps = Pick<GlobalActions, 'openUserInfo'>;

const UserLink: FC<OwnProps & DispatchProps> = ({
  className, sender, openUserInfo, children,
}) => {
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

export default withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['openUserInfo']),
)(UserLink);
