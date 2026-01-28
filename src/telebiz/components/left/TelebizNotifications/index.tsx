import type { FC } from '../../../../lib/teact/teact';
import { memo, useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Notification } from '../../../services/types';
import { LoadMoreDirection } from '../../../../types';

import {
  selectTelebizNotifications,
  selectTelebizNotificationsIsLoading,
  selectTelebizNotificationsList,
  selectTelebizNotificationsTotal,
  selectTelebizNotificationsUnreadCount,
} from '../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { throttle } from '../../../../util/schedulers';

import NothingFound from '../../../../components/common/NothingFound';
import InfiniteScroll from '../../../../components/ui/InfiniteScroll';
import TabList from '../../../../components/ui/TabList';
import TelebizNotification from './TelebizNotification';

import styles from './TelebizNotifications.module.scss';

const runThrottled = throttle((cb) => cb(), 500, true);

interface OwnProps {
  isActive: boolean;
}

type StateProps = {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  allCount: number;
  isLoading: boolean;
  initialFetch: boolean;
};

const TelebizNotifications: FC<OwnProps & StateProps> = ({
  isActive,
  notifications,
  total,
  unreadCount,
  allCount,
  isLoading,
  initialFetch,
}) => {
  const {
    loadTelebizNotifications,
    resetTelebizNotifications,
  } = getActions();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isActive) {
      setActiveTab(0);
      setSelectedNotificationId(undefined);
      resetTelebizNotifications({ currentType: 'all' });
    }
  }, [isActive, resetTelebizNotifications]);

  const handleLoadMore = useCallback(({ direction }: { direction: LoadMoreDirection }) => {
    if (!isActive) return;
    if (direction === LoadMoreDirection.Backwards) {
      if (notifications.length === total && !initialFetch) return;
      runThrottled(() => {
        loadTelebizNotifications({
          offset: notifications.length,
          unreadOnly: activeTab === 1,
          limit: 20,
        });
      });
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [activeTab, notifications.length, total, initialFetch]);

  const handleSwitchTab = useCallback((tabId: number): void => {
    setActiveTab(tabId);
    setSelectedNotificationId(undefined);
    resetTelebizNotifications({ currentType: tabId === 0 ? 'all' : 'unread' });
  }, [resetTelebizNotifications]);

  return (
    <div className={styles.notificationsContainer}>
      <TabList
        activeTab={activeTab}
        tabs={[{
          id: 0,
          title: 'All',
          badgeCount: allCount,
        }, {
          id: 1,
          title: 'Unread',
          badgeCount: unreadCount,
        }]}
        onSwitchTab={handleSwitchTab}
        className={styles.tabList}
        tabClassName={styles.tabListItem}
      />
      <InfiniteScroll
        className={buildClassName(styles.container, 'custom-scroll')}
        preloadBackwards={1}
        items={notifications}
        itemSelector={`.${styles.notification}`}
        onLoadMore={handleLoadMore}
        noFastList
      >
        {!isLoading && notifications.length === 0 && (
          <NothingFound
            text={activeTab === 0 ? 'No notifications found' : 'No unread notifications found'}
            description={activeTab === 0 ? 'No notifications yet, check back later.' : 'You are all caught up!'}
            withSticker
          />
        )}
        {notifications.map((notification) => (
          <TelebizNotification
            key={notification.id}
            notification={notification}
            className={styles.notification}
            isSelected={selectedNotificationId === notification.id.toString() && activeTab !== 1}
            onClick={setSelectedNotificationId}
          />
        ))}
      </InfiniteScroll>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const notificationsState = selectTelebizNotifications(global);
    return {
      notifications: selectTelebizNotificationsList(global),
      total: selectTelebizNotificationsTotal(global),
      unreadCount: selectTelebizNotificationsUnreadCount(global),
      allCount: notificationsState.allCount,
      isLoading: selectTelebizNotificationsIsLoading(global),
      initialFetch: notificationsState.initialFetch,
    };
  },
)(TelebizNotifications));
