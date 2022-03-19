import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiBotCommand, ApiUser, ApiUserStatus, ApiUserType,
} from '../../types';
import { buildApiPeerId } from './peers';

export function buildApiUserFromFull(mtpUserFull: GramJs.users.UserFull): ApiUser {
  const {
    fullUser: {
      about, commonChatsCount, pinnedMsgId, botInfo, blocked,
    },
    users,
  } = mtpUserFull;

  const user = buildApiUser(users[0])!;

  return {
    ...user,
    fullInfo: {
      bio: about,
      commonChatsCount,
      pinnedMessageId: pinnedMsgId,
      isBlocked: Boolean(blocked),
      ...(botInfo && { botDescription: botInfo.description }),
      ...(botInfo && botInfo.commands.length && { botCommands: buildApiBotCommands(user.id, botInfo) }),
    },
  };
}

export function buildApiUser(mtpUser: GramJs.TypeUser): ApiUser | undefined {
  if (!(mtpUser instanceof GramJs.User)) {
    return undefined;
  }

  const { id, firstName, lastName } = mtpUser;
  const avatarHash = mtpUser.photo instanceof GramJs.UserProfilePhoto
    ? String(mtpUser.photo.photoId)
    : undefined;
  const userType = buildApiUserType(mtpUser);

  return {
    id: buildApiPeerId(id, 'user'),
    isMin: Boolean(mtpUser.min),
    ...(mtpUser.self && { isSelf: true }),
    ...(mtpUser.verified && { isVerified: true }),
    ...((mtpUser.contact || mtpUser.mutualContact) && { isContact: true }),
    type: userType,
    ...(firstName && { firstName }),
    ...(userType === 'userTypeBot' && { canBeInvitedToGroup: !mtpUser.botNochats }),
    ...(lastName && { lastName }),
    username: mtpUser.username || '',
    phoneNumber: mtpUser.phone || '',
    noStatus: !mtpUser.status,
    ...(mtpUser.accessHash && { accessHash: String(mtpUser.accessHash) }),
    ...(avatarHash && { avatarHash }),
    ...(mtpUser.bot && mtpUser.botInlinePlaceholder && { botPlaceholder: mtpUser.botInlinePlaceholder }),
  };
}

function buildApiUserType(user: GramJs.User): ApiUserType {
  if (user.bot) {
    return 'userTypeBot';
  }
  if (user.deleted) {
    return 'userTypeDeleted';
  }

  return 'userTypeRegular';
}

export function buildApiUserStatus(mtpStatus?: GramJs.TypeUserStatus): ApiUserStatus {
  if (!mtpStatus || mtpStatus instanceof GramJs.UserStatusEmpty) {
    return { type: 'userStatusEmpty' };
  } else if (mtpStatus instanceof GramJs.UserStatusOnline) {
    return { type: 'userStatusOnline', expires: mtpStatus.expires };
  } else if (mtpStatus instanceof GramJs.UserStatusOffline) {
    return { type: 'userStatusOffline', wasOnline: mtpStatus.wasOnline };
  } else if (mtpStatus instanceof GramJs.UserStatusRecently) {
    return { type: 'userStatusRecently' };
  } else if (mtpStatus instanceof GramJs.UserStatusLastWeek) {
    return { type: 'userStatusLastWeek' };
  } else {
    return { type: 'userStatusLastMonth' };
  }
}

function buildApiBotCommands(botId: string, botInfo: GramJs.BotInfo) {
  return botInfo.commands.map(({ command, description }) => ({
    botId,
    command,
    description,
  })) as ApiBotCommand[];
}

export function buildApiUsersAndStatuses(mtpUsers: GramJs.TypeUser[]) {
  const userStatusesById: Record<string, ApiUserStatus> = {};
  const users: ApiUser[] = [];

  mtpUsers.forEach((mtpUser) => {
    const user = buildApiUser(mtpUser);
    if (!user) {
      return;
    }

    users.push(user);

    if ('status' in mtpUser) {
      userStatusesById[user.id] = buildApiUserStatus(mtpUser.status);
    }
  });

  return { users, userStatusesById };
}
