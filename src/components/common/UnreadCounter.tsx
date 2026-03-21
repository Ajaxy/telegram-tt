import { memo, useEffect } from '../../lib/teact/teact';

import { ALL_FOLDER_ID } from '../../config';
import { updateAppBadge } from '../../util/appBadge';
import { formatIntegerCompact } from '../../util/textFormat';

import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';
import useLang from '../../hooks/useLang';

interface OwnProps {
  isForAppBadge?: boolean;
}

const UnreadCounter = ({ isForAppBadge }: OwnProps) => {
  const unreadCounters = useFolderManagerForUnreadCounters();
  const unreadNotificationsCount = unreadCounters[ALL_FOLDER_ID]?.notificationsCount || 0;

  const lang = useLang();

  useEffect(() => {
    if (isForAppBadge) {
      updateAppBadge(unreadNotificationsCount);
    }
  }, [isForAppBadge, unreadNotificationsCount]);

  if (isForAppBadge || !unreadNotificationsCount) {
    return undefined;
  }

  return (
    <div className="unread-count active">{formatIntegerCompact(lang, unreadNotificationsCount)}</div>
  );
};

export default memo(UnreadCounter);
