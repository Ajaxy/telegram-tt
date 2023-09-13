import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect } from '../../lib/teact/teact';

import { updateAppBadge } from '../../util/appBadge';
import { getAllNotificationsCount } from '../../util/folderManager';
import { formatIntegerCompact } from '../../util/textFormat';

import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';

interface OwnProps {
  isForAppBadge?: boolean;
}

const UnreadCounter: FC<OwnProps> = ({ isForAppBadge }) => {
  useFolderManagerForUnreadCounters();
  const unreadNotificationsCount = getAllNotificationsCount();

  useEffect(() => {
    if (isForAppBadge) {
      updateAppBadge(unreadNotificationsCount);
    }
  }, [isForAppBadge, unreadNotificationsCount]);

  if (isForAppBadge || !unreadNotificationsCount) {
    return undefined;
  }

  return (
    <div className="unread-count active">{formatIntegerCompact(unreadNotificationsCount)}</div>
  );
};

export default memo(UnreadCounter);
