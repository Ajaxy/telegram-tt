import { ApiChat, ApiUser } from '../../api/types';

import { SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { formatFullDate, formatTime } from '../../util/dateFormat';
import { orderBy } from '../../util/iteratees';
import { LangFn } from '../../hooks/useLang';
import { getServerTime } from '../../util/serverTime';

const USER_COLOR_KEYS = [1, 8, 5, 2, 7, 4, 6];

export function getUserFirstOrLastName(user?: ApiUser) {
  if (!user) {
    return undefined;
  }

  switch (user.type) {
    case 'userTypeBot':
    case 'userTypeRegular': {
      return user.firstName || user.lastName;
    }

    case 'userTypeDeleted':
    case 'userTypeUnknown': {
      return 'Deleted';
    }

    default:
      return undefined;
  }
}

export function getUserFullName(user?: ApiUser) {
  if (!user) {
    return undefined;
  }

  if (isDeletedUser(user)) {
    return 'Deleted account';
  }

  switch (user.type) {
    case 'userTypeBot':
    case 'userTypeRegular': {
      if (user.firstName && user.lastName) {
        return `${user.firstName} ${user.lastName}`;
      }

      if (user.firstName) {
        return user.firstName;
      }

      if (user.lastName) {
        return user.lastName;
      }

      break;
    }

    case 'userTypeDeleted':
    case 'userTypeUnknown': {
      return 'Deleted account';
    }
  }

  return undefined;
}

export function getUserStatus(lang: LangFn, user: ApiUser, serverTimeOffset: number) {
  if (user.id === SERVICE_NOTIFICATIONS_USER_ID) {
    return lang('ServiceNotifications').toLowerCase();
  }

  if (user.type && user.type === 'userTypeBot') {
    return lang('Bot');
  }

  if (!user.status) {
    return '';
  }

  switch (user.status.type) {
    case 'userStatusEmpty': {
      return lang('ALongTimeAgo');
    }

    case 'userStatusLastMonth': {
      return lang('WithinAMonth');
    }

    case 'userStatusLastWeek': {
      return lang('WithinAWeek');
    }

    case 'userStatusOffline': {
      const { wasOnline } = user.status;

      if (!wasOnline) return lang('LastSeen.Offline');

      const now = new Date(new Date().getTime() + serverTimeOffset * 1000);
      const wasOnlineDate = new Date(wasOnline * 1000);

      if (wasOnlineDate >= now) {
        return lang('LastSeen.JustNow');
      }

      const diff = new Date(now.getTime() - wasOnlineDate.getTime());

      // within a minute
      if (diff.getTime() / 1000 < 60) {
        return lang('LastSeen.JustNow');
      }

      // within an hour
      if (diff.getTime() / 1000 < 60 * 60) {
        const minutes = Math.floor(diff.getTime() / 1000 / 60);
        return lang('LastSeen.MinutesAgo', minutes);
      }

      // today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const serverToday = new Date(today.getTime() + serverTimeOffset * 1000);
      if (wasOnlineDate > serverToday) {
        // up to 6 hours ago
        if (diff.getTime() / 1000 < 6 * 60 * 60) {
          const hours = Math.floor(diff.getTime() / 1000 / 60 / 60);
          return lang('LastSeen.HoursAgo', hours);
        }

        // other
        return lang('LastSeen.TodayAt', formatTime(wasOnlineDate, lang));
      }

      // yesterday
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const serverYesterday = new Date(yesterday.getTime() + serverTimeOffset * 1000);
      if (wasOnlineDate > serverYesterday) {
        return lang('LastSeen.YesterdayAt', formatTime(wasOnlineDate, lang));
      }

      return lang('LastSeen.AtDate', formatFullDate(lang, wasOnlineDate));
    }

    case 'userStatusOnline': {
      return lang('Online');
    }

    case 'userStatusRecently': {
      return lang('Lately');
    }

    default:
      return undefined;
  }
}

export function isUserOnline(user: ApiUser) {
  const { id, status, type } = user;

  if (!status) {
    return false;
  }

  if (id === SERVICE_NOTIFICATIONS_USER_ID) {
    return false;
  }

  return status.type === 'userStatusOnline' && type !== 'userTypeBot';
}

export function isDeletedUser(user: ApiUser) {
  if (!user.status || user.type === 'userTypeBot' || user.id === SERVICE_NOTIFICATIONS_USER_ID) {
    return false;
  }

  return user.type === 'userTypeDeleted'
    || user.type === 'userTypeUnknown';
}

export function isUserBot(user: ApiUser) {
  return user.type === 'userTypeBot';
}

export function getCanAddContact(user: ApiUser) {
  return !user.isContact && !isUserBot(user);
}

export function sortUserIds(
  userIds: number[],
  usersById: Record<number, ApiUser>,
  priorityIds?: number[],
  serverTimeOffset = 0,
) {
  return orderBy(userIds, (id) => {
    const now = getServerTime(serverTimeOffset);

    if (priorityIds && priorityIds.includes(id)) {
      // Assuming that online status expiration date can't be as far as two days from now,
      // this should place prioritized on top of the list.
      // Then we subtract index of `id` in `priorityIds` to preserve selected order
      return now + (48 * 60 * 60) - (priorityIds.length - priorityIds.indexOf(id));
    }

    const user = usersById[id];
    if (!user || !user.status) {
      return 0;
    }

    if (user.status.type === 'userStatusOnline') {
      return user.status.expires;
    } else if (user.status.type === 'userStatusOffline' && user.status.wasOnline) {
      return user.status.wasOnline;
    }

    switch (user.status.type) {
      case 'userStatusRecently':
        return now - 60 * 60 * 24;
      case 'userStatusLastWeek':
        return now - 60 * 60 * 24 * 7;
      case 'userStatusLastMonth':
        return now - 60 * 60 * 24 * 7 * 30;
      default:
        return 0;
    }
  }, 'desc');
}

// eslint-disable-next-line max-len
// https://github.com/telegramdesktop/tdesktop/blob/371510cfe23b0bd226de8c076bc49248fbe40c26/Telegram/SourceFiles/data/data_peer.cpp#L53
export function getUserColorKey(peer: ApiUser | ApiChat | undefined) {
  const index = peer ? Math.abs(peer.id) % 7 : 0;

  return USER_COLOR_KEYS[index];
}
