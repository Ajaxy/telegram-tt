import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';

import type { ApiGroupCall } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';
import { getActions } from '../../global';

type OwnProps = {
  className?: string;
  groupCall?: Partial<ApiGroupCall>;
  children: React.ReactNode;
};

const GroupCallLink: FC<OwnProps> = ({
  className, groupCall, children,
}) => {
  const { joinGroupCall } = getActions();

  const handleClick = useCallback(() => {
    if (groupCall) {
      joinGroupCall({ id: groupCall.id, accessHash: groupCall.accessHash });
    }
  }, [groupCall, joinGroupCall]);

  if (!groupCall) {
    return children;
  }

  return (
    <Link className={buildClassName('GroupCallLink', className)} onClick={handleClick}>{children}</Link>
  );
};

export default GroupCallLink;
