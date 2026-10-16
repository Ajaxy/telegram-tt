import type { ApiPeer, ApiUser, ApiUserStatus } from '../../api/types';
import type { LangFn } from '../../util/localization';

import { ANONYMOUS_USER_ID, SERVICE_NOTIFICATIONS_USER_ID } from '../../config';
import { DAY } from '../../util/dates/units';
import { orderBy } from '../../util/iteratees';
import { formatRecentTimestamp, secondsToDate } from '../../util/localization/dateFormat';
import { formatPhoneNumber } from '../../util/phoneNumber';
import { getServerTime } from '../../util/serverTime';

export function getUserFirstOrLastName(lang: LangFn, user?: ApiUser) {
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
      return lang('Deleted');
    }

    default:
      return undefined;
  }
}

export function getUserFullName(lang: LangFn, user?: ApiUser) {
  if (!user) {
    return undefined;
  }

  if (isDeletedUser(user)) {
    return lang('HiddenName');
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
  lang: LangFn, user: ApiUser, userStatus: ApiUserStatus | undefined,
) {
  if (user.id === SERVICE_NOTIFICATIONS_USER_ID) {
    return lang('ServiceNotifications');
  }

  if (user.isSupport) {
    return lang('SupportStatus');
  }

  if (user.type && user.type === 'userTypeBot') {
    if (user.botActiveUsers) {
      return lang('Users', { count: lang.number(user.botActiveUsers) }, { pluralValue: user.botActiveUsers });
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

      if (!wasOnline) return lang('LastSeenOffline');

      return formatRecentTimestamp(lang, secondsToDate(wasOnline), { context: 'lastSeen' });
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
