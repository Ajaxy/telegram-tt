import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { LANG_PACKS } from '../../../config';
import type { ApiInputPrivacyRules, ApiPrivacyKey, LangCode } from '../../../types';
import type {
  ApiAppConfig,
  ApiConfig,
  ApiError,
  ApiLanguage,
  ApiNotifyException,
  ApiPhoto,
  ApiUser,
} from '../../types';

import { BLOCKED_LIST_LIMIT, DEFAULT_LANG_PACK, MAX_INT_32 } from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';
import { buildAppConfig } from '../apiBuilders/appConfig';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiPhoto, buildPrivacyRules } from '../apiBuilders/common';
import { omitVirtualClassFields } from '../apiBuilders/helpers';
import {
  buildApiConfig,
  buildApiCountryList,
  buildApiNotifyException,
  buildApiPeerColors,
  buildApiSession,
  buildApiWallpaper,
  buildApiWebSession, buildLangPack, buildLangPackString,
} from '../apiBuilders/misc';
import { getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import { buildApiUser } from '../apiBuilders/users';
import {
  buildInputEntity, buildInputPeer, buildInputPhoto,
  buildInputPrivacyKey,
  buildInputPrivacyRules,
} from '../gramjsBuilders';
import { addEntitiesToLocalDb, addPhotoToLocalDb } from '../helpers';
import localDb from '../localDb';
import { getClient, invokeRequest, uploadFile } from './client';
import { ACCEPTABLE_USERNAME_ERRORS } from './management';

const BETA_LANG_CODES = ['ar', 'fa', 'id', 'ko', 'uz', 'en'];

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
  }), {
    shouldReturnTrue: true,
  });
}

export async function checkUsername(username: string) {
  try {
    const result = await invokeRequest(new GramJs.account.CheckUsername({
      username,
    }), {
      shouldThrow: true,
    });

    return { result, error: undefined };
  } catch (error) {
    const errorMessage = (error as ApiError).message;

    if (ACCEPTABLE_USERNAME_ERRORS.has(errorMessage)) {
      return {
        result: false,
        error: errorMessage,
      };
    }

    throw error;
  }
}

export function updateUsername(username: string) {
  return invokeRequest(new GramJs.account.UpdateUsername({ username }), {
    shouldReturnTrue: true,
  });
}

export async function updateProfilePhoto(photo?: ApiPhoto, isFallback?: boolean) {
  const photoId = photo ? buildInputPhoto(photo) : new GramJs.InputPhotoEmpty();
  const result = await invokeRequest(new GramJs.photos.UpdateProfilePhoto({
    id: photoId,
    ...(isFallback ? { fallback: true } : undefined),
  }));
  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);
  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
      users: result.users.map(buildApiUser).filter(Boolean),
      photo: buildApiPhoto(result.photo),
    };
  }
  return undefined;
}

export async function uploadProfilePhoto(file: File, isFallback?: boolean, isVideo = false, videoTs = 0) {
  const inputFile = await uploadFile(file);
  const result = await invokeRequest(new GramJs.photos.UploadProfilePhoto({
    ...(isVideo ? { video: inputFile, videoStartTs: videoTs } : { file: inputFile }),
    ...(isFallback ? { fallback: true } : undefined),
  }));

  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);
  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
      users: result.users.map(buildApiUser).filter(Boolean),
      photo: buildApiPhoto(result.photo),
    };
  }
  return undefined;
}

export async function uploadContactProfilePhoto({
  file, isSuggest, user,
}: {
  file?: File;
  isSuggest?: boolean;
  user: ApiUser;
}) {
  const inputFile = file ? await uploadFile(file) : undefined;
  const result = await invokeRequest(new GramJs.photos.UploadContactProfilePhoto({
    userId: buildInputEntity(user.id, user.accessHash) as GramJs.InputUser,
    file: inputFile,
    ...(isSuggest ? { suggest: true } : { save: true }),
  }));

  if (!result) return undefined;

  addEntitiesToLocalDb(result.users);

  const users = result.users.map(buildApiUser).filter(Boolean);

  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
      users,
      photo: buildApiPhoto(result.photo),
    };
  }

  return {
    users,
    photo: undefined,
  };
}

export async function deleteProfilePhotos(photos: ApiPhoto[]) {
  const photoIds = photos.map(buildInputPhoto).filter(Boolean);
  const isDeleted = await invokeRequest(new GramJs.photos.DeletePhotos({ id: photoIds }), {
    shouldReturnTrue: true,
  });
  if (isDeleted) {
    photos.forEach((photo) => {
      delete localDb.photos[photo.id];
    });
  }
  return isDeleted;
}

export async function fetchWallpapers() {
  const result = await invokeRequest(new GramJs.account.GetWallPapers({ hash: BigInt('0') }));

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
    wallpapers: filteredWallpapers.map(buildApiWallpaper).filter(Boolean),
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

export async function fetchBlockedUsers({
  isOnlyStories,
}: {
  isOnlyStories?: true;
}) {
  const result = await invokeRequest(new GramJs.contacts.GetBlocked({
    myStoriesFrom: isOnlyStories,
    limit: BLOCKED_LIST_LIMIT,
  }));
  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((chat) => buildApiChatFromPreview(chat)).filter(Boolean),
    blockedIds: result.blocked.map((blocked) => getApiChatIdFromMtpPeer(blocked.peerId)),
    totalCount: result instanceof GramJs.contacts.BlockedSlice ? result.count : result.blocked.length,
  };
}

export function blockUser({
  user,
  isOnlyStories,
}: {
  user: ApiUser;
  isOnlyStories?: true;
}) {
  return invokeRequest(new GramJs.contacts.Block({
    id: buildInputPeer(user.id, user.accessHash),
    myStoriesFrom: isOnlyStories,
  }));
}

export function unblockUser({
  user,
  isOnlyStories,
}: {
  user: ApiUser;
  isOnlyStories?: true;
}) {
  return invokeRequest(new GramJs.contacts.Unblock({
    id: buildInputPeer(user.id, user.accessHash),
    myStoriesFrom: isOnlyStories,
  }));
}

export async function fetchAuthorizations() {
  const result = await invokeRequest(new GramJs.account.GetAuthorizations());
  if (!result) {
    return undefined;
  }

  return {
    authorizations: buildCollectionByKey(result.authorizations.map(buildApiSession), 'hash'),
    ttlDays: result.authorizationTtlDays,
  };
}

export function terminateAuthorization(hash: string) {
  return invokeRequest(new GramJs.account.ResetAuthorization({ hash: BigInt(hash) }));
}

export function terminateAllAuthorizations() {
  return invokeRequest(new GramJs.auth.ResetAuthorizations());
}

export async function fetchWebAuthorizations() {
  const result = await invokeRequest(new GramJs.account.GetWebAuthorizations());
  if (!result) {
    return undefined;
  }
  addEntitiesToLocalDb(result.users);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    webAuthorizations: buildCollectionByKey(result.authorizations.map(buildApiWebSession), 'hash'),
  };
}

export function terminateWebAuthorization(hash: string) {
  return invokeRequest(new GramJs.account.ResetWebAuthorization({ hash: BigInt(hash) }));
}

export function terminateAllWebAuthorizations() {
  return invokeRequest(new GramJs.account.ResetWebAuthorizations());
}

export async function fetchNotificationExceptions() {
  const result = await invokeRequest(new GramJs.account.GetNotifyExceptions({
    compareSound: true,
  }), {
    shouldIgnoreUpdates: true,
  });

  if (!(result instanceof GramJs.Updates || result instanceof GramJs.UpdatesCombined)) {
    return undefined;
  }

  updateLocalDb(result);

  return result.updates.reduce((acc, update) => {
    if (!(update instanceof GramJs.UpdateNotifySettings && update.peer instanceof GramJs.NotifyPeer)) {
      return acc;
    }

    acc.push(buildApiNotifyException(update.notifySettings, update.peer.peer));

    return acc;
  }, [] as ApiNotifyException[]);
}

export async function fetchNotificationSettings() {
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
      privateSilent
      || (typeof privateMuteUntil === 'number' && getServerTime() < privateMuteUntil)
    ),
    hasPrivateChatsMessagePreview: privateShowPreviews,
    hasGroupNotifications: !(
      groupSilent || (typeof groupMuteUntil === 'number'
        && getServerTime() < groupMuteUntil)
    ),
    hasGroupMessagePreview: groupShowPreviews,
    hasBroadcastNotifications: !(
      broadcastSilent || (typeof broadcastMuteUntil === 'number'
        && getServerTime() < broadcastMuteUntil)
    ),
    hasBroadcastMessagePreview: broadcastShowPreviews,
  };
}

export function updateContactSignUpNotification(isSilent: boolean) {
  return invokeRequest(new GramJs.account.SetContactSignUpNotification({ silent: isSilent }));
}

export function updateNotificationSettings(peerType: 'contact' | 'group' | 'broadcast', {
  isSilent,
  shouldShowPreviews,
}: {
  isSilent?: boolean;
  shouldShowPreviews?: boolean;
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
    showPreviews: shouldShowPreviews,
    silent: isSilent,
    muteUntil: isSilent ? MAX_INT_32 : 0,
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

export async function fetchLangPack({ sourceLangPacks, langCode }: {
  sourceLangPacks: typeof LANG_PACKS;
  langCode: string;
}) {
  const results = await Promise.all(sourceLangPacks.map((langPack) => {
    return invokeRequest(new GramJs.langpack.GetLangPack({
      langPack,
      langCode: BETA_LANG_CODES.includes(langCode) ? `${langCode}-raw` : langCode,
    }));
  }));

  const collections = results.filter(Boolean).map(buildLangPack);
  if (!collections.length) {
    return undefined;
  }

  return { langPack: Object.assign({}, ...collections.reverse()) as typeof collections[0] };
}

export async function fetchLangStrings({ langPack, langCode, keys }: {
  langPack: string; langCode: string; keys: string[];
}) {
  const result = await invokeRequest(new GramJs.langpack.GetStrings({
    langPack,
    langCode: BETA_LANG_CODES.includes(langCode) ? `${langCode}-raw` : langCode,
    keys,
  }));

  if (!result) {
    return undefined;
  }

  return result.map(buildLangPackString);
}

export async function fetchPrivacySettings(privacyKey: ApiPrivacyKey) {
  const key = buildInputPrivacyKey(privacyKey);
  const result = await invokeRequest(new GramJs.account.GetPrivacy({ key }));

  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    rules: buildPrivacyRules(result.rules),
  };
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
  privacyKey: ApiPrivacyKey, rules: ApiInputPrivacyRules,
) {
  const key = buildInputPrivacyKey(privacyKey);
  const privacyRules = buildInputPrivacyRules(rules);

  const result = await invokeRequest(new GramJs.account.SetPrivacy({ key, rules: privacyRules }));

  if (!result) {
    return undefined;
  }

  updateLocalDb(result);

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    rules: buildPrivacyRules(result.rules),
  };
}

export async function updateIsOnline(isOnline: boolean) {
  await invokeRequest(new GramJs.account.UpdateStatus({ offline: !isOnline }));
}

export async function fetchContentSettings() {
  const result = await invokeRequest(new GramJs.account.GetContentSettings());
  if (!result) {
    return undefined;
  }

  return {
    isSensitiveEnabled: Boolean(result.sensitiveEnabled),
    canChangeSensitive: Boolean(result.sensitiveCanChange),
  };
}

export function updateContentSettings(isEnabled: boolean) {
  return invokeRequest(new GramJs.account.SetContentSettings({
    sensitiveEnabled: isEnabled || undefined,
  }));
}

export async function fetchAppConfig(hash?: number): Promise<ApiAppConfig | undefined> {
  const result = await invokeRequest(new GramJs.help.GetAppConfig({ hash }));
  if (!result || result instanceof GramJs.help.AppConfigNotModified) return undefined;

  const { config, hash: resultHash } = result;
  return buildAppConfig(config, resultHash);
}

export async function fetchConfig(): Promise<ApiConfig | undefined> {
  const result = await invokeRequest(new GramJs.help.GetConfig());
  if (!result) return undefined;

  return buildApiConfig(result);
}

export async function fetchPeerColors(hash?: number) {
  const result = await invokeRequest(new GramJs.help.GetPeerColors({
    hash,
  }));
  if (!result) return undefined;

  const colors = buildApiPeerColors(result);
  if (!colors) return undefined;

  const newHash = result instanceof GramJs.help.PeerColors ? result.hash : undefined;

  return {
    colors,
    hash: newHash,
  };
}

function updateLocalDb(
  result: (
    GramJs.account.PrivacyRules | GramJs.contacts.Blocked | GramJs.contacts.BlockedSlice |
    GramJs.Updates | GramJs.UpdatesCombined
  ),
) {
  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);
}

export async function fetchCountryList({ langCode = 'en' }: { langCode?: LangCode }) {
  const countryList = await invokeRequest(new GramJs.help.GetCountriesList({
    langCode,
  }));

  if (!(countryList instanceof GramJs.help.CountriesList)) {
    return undefined;
  }
  return buildApiCountryList(countryList.countries);
}

export async function fetchGlobalPrivacySettings() {
  const result = await invokeRequest(new GramJs.account.GetGlobalPrivacySettings());

  if (!result) {
    return undefined;
  }

  return {
    shouldArchiveAndMuteNewNonContact: Boolean(result.archiveAndMuteNewNoncontactPeers),
  };
}

export async function updateGlobalPrivacySettings({ shouldArchiveAndMuteNewNonContact }: {
  shouldArchiveAndMuteNewNonContact: boolean;
}) {
  const result = await invokeRequest(new GramJs.account.SetGlobalPrivacySettings({
    settings: new GramJs.GlobalPrivacySettings({
      ...(shouldArchiveAndMuteNewNonContact && { archiveAndMuteNewNoncontactPeers: true }),
    }),
  }));

  if (!result) {
    return undefined;
  }

  return {
    shouldArchiveAndMuteNewNonContact: Boolean(result.archiveAndMuteNewNoncontactPeers),
  };
}

export function toggleUsername({
  chatId, accessHash, username, isActive,
}: {
  username: string;
  isActive: boolean;
  chatId?: string;
  accessHash?: string;
}) {
  if (chatId) {
    return invokeRequest(new GramJs.channels.ToggleUsername({
      channel: buildInputEntity(chatId, accessHash) as GramJs.InputChannel,
      username,
      active: isActive,
    }));
  }

  return invokeRequest(new GramJs.account.ToggleUsername({
    username,
    active: isActive,
  }));
}

export function reorderUsernames({ chatId, accessHash, usernames }: {
  usernames: string[];
  chatId?: string;
  accessHash?: string;
}) {
  if (chatId) {
    return invokeRequest(new GramJs.channels.ReorderUsernames({
      channel: buildInputEntity(chatId, accessHash) as GramJs.InputChannel,
      order: usernames,
    }));
  }

  return invokeRequest(new GramJs.account.ReorderUsernames({
    order: usernames,
  }));
}
