import React, { FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalState } from '../../global/types';

import { selectCountNotMutedUnreadOptimized } from '../../modules/selectors';
import { formatIntegerCompact } from '../../util/textFormat';

type StateProps = {
  unreadCount: number;
};

const UnreadCount: FC<StateProps> = ({
  unreadCount,
}) => {
  if (!unreadCount) {
    return undefined;
  }

  return (
    <div className="unread-count active">{formatIntegerCompact(unreadCount)}</div>
  );
};

export default memo(withGlobal(
  (global: GlobalState): StateProps => {
    return {
      unreadCount: selectCountNotMutedUnreadOptimized(global),
    };
  },
)(UnreadCount));
