import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import {
  ApiChat, ApiLangString, ApiLanguage, ApiUser, ApiWallpaper,
} from '../../types';
import { ApiPrivacyKey, IInputPrivacyRules } from '../../../types';

import { BLOCKED_LIST_LIMIT, DEFAULT_LANG_PACK } from '../../../config';
import { buildApiWallpaper, buildApiSession, buildPrivacyRules } from '../apiBuilders/misc';

import { buildApiUser } from '../apiBuilders/users';
import { buildApiChatFromPreview, getApiChatIdFromMtpPeer } from '../apiBuilders/chats';
import { buildInputPrivacyKey, buildInputPeer, buildPeer } from '../gramjsBuilders';
import { invokeRequest, uploadFile, getClient } from './client';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import { buildCollectionByKey } from '../../../util/iteratees';
import localDb from '../localDb';

const MAX_INT_32 = 2 ** 31 - 1;

export function updateProfile({
  firstName,
  lastName,
  about,
}: {
  firstName?: string;
  lastName?: string;
  about?: string;
}) {
  return invokeRequest(new GramJs.account.UpdateProfile({
    firstName: firstName || '',
    lastName: lastName || '',
    about: about || '',
  }));
}

export function checkUsername(username: string) {
  return invokeRequest(new GramJs.account.CheckUsername({ username }));
}

export function updateUsername(username: string) {
  return invokeRequest(new GramJs.account.UpdateUsername({ username }));
}

export async function updateProfilePhoto(file: File) {
  const inputFile = await uploadFile(file);
  return invokeRequest(new GramJs.photos.UploadProfilePhoto({
    file: inputFile,
  }));
}

export async function uploadProfilePhoto(file: File) {
  const inputFile = await uploadFile(file);
  await invokeRequest(new GramJs.photos.UploadProfilePhoto({
    file: inputFile,
  }));
}

export async function fetchWallpapers(hash: number) {
  const result = await invokeRequest(new GramJs.account.GetWallPapers({ hash }));

  if (!result || result instanceof GramJs.account.WallPapersNotModified) {
    return undefined;
  }

  const filteredWallpapers = result.wallpapers.filter((wallpaper) => {
    if (
      !(wallpaper instanceof GramJs.WallPaper)
      || !(wallpaper.document instanceof GramJs.Document)
    ) {
      return false;
    }

    return !wallpaper.pattern && wallpaper.document.mimeType !== 'application/x-tgwallpattern';
  }) as GramJs.WallPaper[];

  filteredWallpapers.forEach((wallpaper) => {
    localDb.documents[String(wallpaper.document.id)] = wallpaper.document as GramJs.Document;
  });

  return {
    hash: result.hash,
    wallpapers: filteredWallpapers.map(buildApiWallpaper).filter<ApiWallpaper>(Boolean as any),
  };
}

export async function uploadWallpaper(file: File) {
  const inputFile = await uploadFile(file);

  const result = await invokeRequest(new GramJs.account.UploadWallPaper({
    file: inputFile,
    mimeType: file.type,
    settings: new GramJs.WallPaperSettings(),
  }));

  if (!result || !(result instanceof GramJs.WallPaper)) {
    return undefined;
  }

  const wallpaper = buildApiWallpaper(result);
  if (!wallpaper) {
    return undefined;
  }

  localDb.documents[String(result.document.id)] = result.document as GramJs.Document;

  return { wallpaper };
}

export async function fetchBlockedContacts() {
  const result = await invokeRequest(new GramJs.contacts.GetBlocked({
    limit: BLOCKED_LIST_LIMIT,
  }));
  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return {
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
    chats: result.chats.map((chat) => buildApiChatFromPreview(chat, undefined, true)).filter<ApiChat>(Boolean as any),
    blockedIds: result.blocked.map((blocked) => getApiChatIdFromMtpPeer(blocked.peerId)),
    totalCount: result instanceof GramJs.contacts.BlockedSlice ? result.count : result.blocked.length,
  };
}

export function blockContact(chatOrUserId: number) {
  return invokeRequest(new GramJs.contacts.Block({
    id: buildPeer(chatOrUserId),
  }));
}

export function unblockContact(chatOrUserId: number, accessHash?: string) {
  return invokeRequest(new GramJs.contacts.Unblock({
    id: buildInputPeer(chatOrUserId, accessHash),
  }));
}

export async function fetchAuthorizations() {
  const result = await invokeRequest(new GramJs.account.GetAuthorizations());
  if (!result) {
    return undefined;
  }

  return result.authorizations.map(buildApiSession);
}

export function terminateAuthorization(hash: string) {
  return invokeRequest(new GramJs.account.ResetAuthorization({ hash: BigInt(hash) }));
}

export function terminateAllAuthorizations() {
  return invokeRequest(new GramJs.auth.ResetAuthorizations());
}

export async function loadNotificationsSettings() {
  const [
    isMutedContactSignUpNotification,
    privateContactNotificationsSettings,
    groupNotificationsSettings,
    broadcastNotificationsSettings,
  ] = await Promise.all([
    invokeRequest(new GramJs.account.GetContactSignUpNotification()),
    invokeRequest(new GramJs.account.GetNotifySettings({
      peer: new GramJs.InputNotifyUsers(),
    })),
    invokeRequest(new GramJs.account.GetNotifySettings({
      peer: new GramJs.InputNotifyChats(),
    })),
    invokeRequest(new GramJs.account.GetNotifySettings({
      peer: new GramJs.InputNotifyBroadcasts(),
    })),
  ]);

  if (!privateContactNotificationsSettings || !groupNotificationsSettings || !broadcastNotificationsSettings) {
    return false;
  }

  const {
    silent: privateSilent, muteUntil: privateMuteUntil, showPreviews: privateShowPreviews,
  } = privateContactNotificationsSettings;
  const {
    silent: groupSilent, muteUntil: groupMuteUntil, showPreviews: groupShowPreviews,
  } = groupNotificationsSettings;
  const {
    silent: broadcastSilent, muteUntil: broadcastMuteUntil, showPreviews: broadcastShowPreviews,
  } = broadcastNotificationsSettings;

  return {
    hasContactJoinedNotifications: !isMutedContactSignUpNotification,
    hasPrivateChatsNotifications: !(
      privateSilent || (typeof privateMuteUntil === 'number' && Date.now() < privateMuteUntil * 1000)
    ),
    hasPrivateChatsMessagePreview: privateShowPreviews,
    hasGroupNotifications: !(
      groupSilent || (typeof groupMuteUntil === 'number' && Date.now() < groupMuteUntil * 1000)
    ),
    hasGroupMessagePreview: groupShowPreviews,
    hasBroadcastNotifications: !(
      broadcastSilent || (typeof broadcastMuteUntil === 'number' && Date.now() < broadcastMuteUntil * 1000)
    ),
    hasBroadcastMessagePreview: broadcastShowPreviews,
  };
}

export function updateContactSignUpNotification(isSilent: boolean) {
  return invokeRequest(new GramJs.account.SetContactSignUpNotification({ silent: isSilent }));
}

export function updateNotificationSettings(peerType: 'contact' | 'group' | 'broadcast', {
  isSilent,
  isShowPreviews,
}: {
  isSilent: boolean;
  isShowPreviews: boolean;
}) {
  let peer: GramJs.TypeInputNotifyPeer;
  if (peerType === 'contact') {
    peer = new GramJs.InputNotifyUsers();
  } else if (peerType === 'group') {
    peer = new GramJs.InputNotifyChats();
  } else {
    peer = new GramJs.InputNotifyBroadcasts();
  }

  const settings = {
    showPreviews: isShowPreviews,
    silent: isSilent,
    muteUntil: isSilent ? MAX_INT_32 : undefined,
  };

  return invokeRequest(new GramJs.account.UpdateNotifySettings({
    peer,
    settings: new GramJs.InputPeerNotifySettings(settings),
  }));
}

export async function fetchLanguages(): Promise<ApiLanguage[] | undefined> {
  const result = await invokeRequest(new GramJs.langpack.GetLanguages({
    langPack: DEFAULT_LANG_PACK,
  }));
  if (!result) {
    return undefined;
  }

  return result.map(omitVirtualClassFields);
}

export async function fetchLangPack({ sourceLangPacks, langCode }: { sourceLangPacks: string[]; langCode: string }) {
  const results = await Promise.all(sourceLangPacks.map((langPack) => {
    return invokeRequest(new GramJs.langpack.GetLangPack({ langPack, langCode }));
  }));

  const collections = results
    .filter<GramJs.LangPackDifference>(Boolean as any)
    .map((result) => {
      return buildCollectionByKey(result.strings.map<ApiLangString>(omitVirtualClassFields), 'key');
    });

  if (!collections.length) {
    return undefined;
  }

  return { langPack: Object.assign({}, ...collections.reverse()) };
}

export async function fetchPrivacySettings(privacyKey: ApiPrivacyKey) {
  const key = buildInputPrivacyKey(privacyKey);
  const result = await invokeRequest(new GramJs.account.GetPrivacy({ key }));

  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return buildPrivacyRules(result.rules);
}

export function registerDevice(token: string) {
  const client = getClient();
  const secret = client.session.getAuthKey().getKey();
  return invokeRequest(new GramJs.account.RegisterDevice({
    tokenType: 10,
    secret,
    appSandbox: false,
    otherUids: [],
    token,
  }));
}

export function unregisterDevice(token: string) {
  return invokeRequest(new GramJs.account.UnregisterDevice({
    tokenType: 10,
    otherUids: [],
    token,
  }));
}

export async function setPrivacySettings(
  privacyKey: ApiPrivacyKey, rules: IInputPrivacyRules,
) {
  const key = buildInputPrivacyKey(privacyKey);
  const privacyRules: GramJs.TypeInputPrivacyRule[] = [];

  if (rules.allowedUsers) {
    privacyRules.push(new GramJs.InputPrivacyValueAllowUsers({
      users: rules.allowedUsers.map(({ id, accessHash }) => buildInputPeer(id, accessHash)),
    }));
  }
  if (rules.allowedChats) {
    privacyRules.push(new GramJs.InputPrivacyValueAllowChatParticipants({
      chats: rules.allowedChats.map(({ id }) => -id),
    }));
  }
  if (rules.blockedUsers) {
    privacyRules.push(new GramJs.InputPrivacyValueDisallowUsers({
      users: rules.blockedUsers.map(({ id, accessHash }) => buildInputPeer(id, accessHash)),
    }));
  }
  if (rules.blockedChats) {
    privacyRules.push(new GramJs.InputPrivacyValueDisallowChatParticipants({
      chats: rules.blockedChats.map(({ id }) => -id),
    }));
  }
  switch (rules.visibility) {
    case 'everybody':
      privacyRules.push(new GramJs.InputPrivacyValueAllowAll());
      break;

    case 'contacts':
      privacyRules.push(new GramJs.InputPrivacyValueAllowContacts());
      break;

    case 'nonContacts':
      privacyRules.push(new GramJs.InputPrivacyValueDisallowContacts());
      break;

    case 'nobody':
      privacyRules.push(new GramJs.InputPrivacyValueDisallowAll());
      break;
  }

  const result = await invokeRequest(new GramJs.account.SetPrivacy({ key, rules: privacyRules }));

  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return buildPrivacyRules(result.rules);
}

function updateLocalDb(result: GramJs.account.PrivacyRules | GramJs.contacts.Blocked | GramJs.contacts.BlockedSlice) {
  result.users.forEach((user) => {
    if (user instanceof GramJs.User) {
      localDb.users[user.id] = user;
    }
  });

  result.chats.forEach((chat) => {
    if (chat instanceof GramJs.Chat || chat instanceof GramJs.Channel) {
      localDb.chats[chat.id] = chat;
    }
  });
}
