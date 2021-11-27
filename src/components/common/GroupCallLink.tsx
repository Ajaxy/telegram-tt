import React, { FC, useCallback } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiGroupCall } from '../../api/types';

import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

import Link from '../ui/Link';

type OwnProps = {
  className?: string;
  groupCall?: Partial<ApiGroupCall>;
  children: any;
};

type DispatchProps = Pick<GlobalActions, 'joinGroupCall'>;

const GroupCallLink: FC<OwnProps & DispatchProps> = ({
  className, groupCall, joinGroupCall, children,
}) => {
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

export default withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['joinGroupCall']),
)(GroupCallLink);
