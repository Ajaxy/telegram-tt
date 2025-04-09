import type { ApiPeer, ApiUser, ApiUserStatus } from '../../api/types';
import type { OldLangFn } from '../../hooks/useOldLang';

import { ANONYMOUS_USER_ID, SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { formatFullDate, formatTime } from '../../util/dates/dateFormat';
import { DAY } from '../../util/dates/units';
import { orderBy } from '../../util/iteratees';
import { formatPhoneNumber } from '../../util/phoneNumber';
import { getServerTime, getServerTimeOffset } from '../../util/serverTime';

export function getUserFirstOrLastName(user?: ApiUser) {
  if (!user) {
    return undefined;
  }

  switch (user.type) {
    case 'userTypeBot':
      return user.firstName;
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
    return 'Deleted Account';
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

      if (user.phoneNumber) {
        return `+${formatPhoneNumber(user.phoneNumber)}`;
      }

      break;
    }
  }

  return undefined;
}

export function getUserStatus(
  lang: OldLangFn, user: ApiUser, userStatus: ApiUserStatus | undefined,
) {
  if (user.id === SERVICE_NOTIFICATIONS_USER_ID) {
    return lang('ServiceNotifications');
  }

  if (user.isSupport) {
    return lang('SupportStatus');
  }

  if (user.type && user.type === 'userTypeBot') {
    if (user.botActiveUsers) {
      return lang('BotUsers', user.botActiveUsers, 'i');
    }
    return lang('Bot');
  }

  if (!userStatus) {
    return '';
  }

  switch (userStatus.type) {
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
      const { wasOnline } = userStatus;

      if (!wasOnline) return lang('LastSeen.Offline');

      const serverTimeOffset = getServerTimeOffset();
      const now = new Date(Date.now() + serverTimeOffset * 1000);
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
        return lang('LastSeen.TodayAt', formatTime(lang, wasOnlineDate));
      }

      // yesterday
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const serverYesterday = new Date(yesterday.getTime() + serverTimeOffset * 1000);
      if (wasOnlineDate > serverYesterday) {
        return lang('LastSeen.YesterdayAt', formatTime(lang, wasOnlineDate));
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

export function isUserOnline(user: ApiUser, userStatus?: ApiUserStatus, withSelfOnline = false) {
  const { id, type } = user;

  if (!userStatus) {
    return false;
  }

  if (id === SERVICE_NOTIFICATIONS_USER_ID) {
    return false;
  }

  if (user.isSelf && !withSelfOnline) {
    return false;
  }

  return userStatus.type === 'userStatusOnline' && type !== 'userTypeBot';
}

export function isDeletedUser(user: ApiUser) {
  return (user.type === 'userTypeDeleted' || user.type === 'userTypeUnknown')
    && user.id !== SERVICE_NOTIFICATIONS_USER_ID;
}

export function isUserBot(user: ApiUser) {
  return user.type === 'userTypeBot';
}

export function getCanAddContact(user: ApiUser) {
  return !user.isSelf && !user.isContact && !isUserBot(user) && user.id !== ANONYMOUS_USER_ID;
}

export function sortUserIds(
  userIds: string[],
  usersById: Record<string, ApiUser>,
  userStatusesById: Record<string, ApiUserStatus>,
  priorityIds?: string[],
) {
  return orderBy(userIds, (id) => {
    const now = getServerTime();

    if (priorityIds && priorityIds.includes(id)) {
      // Assuming that online status expiration date can't be as far as two days from now,
      // this should place prioritized on top of the list.
      // Then we subtract index of `id` in `priorityIds` to preserve selected order
      return now + (48 * 60 * 60) - (priorityIds.length - priorityIds.indexOf(id));
    }

    const user = usersById[id];
    const userStatus = userStatusesById[id];
    if (!user || !userStatus) {
      return 0;
    }

    if (userStatus.type === 'userStatusOnline') {
      return userStatus.expires;
    } else if (userStatus.type === 'userStatusOffline' && userStatus.wasOnline) {
      return userStatus.wasOnline;
    }

    switch (userStatus.type) {
      case 'userStatusRecently':
        return now - DAY;
      case 'userStatusLastWeek':
        return now - DAY * 7;
      case 'userStatusLastMonth':
        return now - DAY * 7 * 30;
      default:
        return 0;
    }
  }, 'desc');
}

export function getMainUsername(userOrChat: ApiPeer) {
  return userOrChat.usernames?.find((u) => u.isActive)?.username;
}

export function getPeerStoryHtmlId(userId: string) {
  return `peer-story${userId}`;
}
