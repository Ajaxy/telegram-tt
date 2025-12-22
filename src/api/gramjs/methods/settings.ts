import { Api as GramJs } from '../../../lib/gramjs';
import { RPCError } from '../../../lib/gramjs/errors';

import type { LANG_PACKS } from '../../../config';
import type {
  ApiBirthday,
  ApiDisallowedGiftsSettings,
  ApiInputPrivacyRules,
  ApiLanguage,
  ApiNotifyPeerType,
  ApiPasskeyRegistrationOption,
  ApiPeerNotifySettings,
  ApiPhoto,
  ApiPrivacyKey,
  ApiUser,
} from '../../types';

import {
  ACCEPTABLE_USERNAME_ERRORS,
  DEBUG,
  LANG_PACK,
  MUTE_INDEFINITE_TIMESTAMP,
  UNMUTE_TIMESTAMP,
} from '../../../config';
import { buildCollectionByKey } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import { BLOCKED_LIST_LIMIT } from '../../../limits';
import { buildApiPhoto, buildPrivacyRules } from '../apiBuilders/common';
import { buildApiDisallowedGiftsSettings } from '../apiBuilders/gifts';
import {
  buildApiCountryList,
  buildApiLanguage,
  buildApiPasskey,
  buildApiSession,
  buildApiTimezone,
  buildApiWallpaper,
  buildApiWebSession,
  buildLangStrings,
  oldBuildLangPack,
} from '../apiBuilders/misc';
import {
  buildApiPeerColors,
  buildApiPeerNotifySettings,
  buildApiPeerProfileColors,
  getApiChatIdFromMtpPeer,
} from '../apiBuilders/peers';
import {
  buildDisallowedGiftsSettings,
  buildInputChannel,
  buildInputPeer,
  buildInputPhoto,
  buildInputPrivacyKey,
  buildInputPrivacyRules,
  buildInputUser,
  DEFAULT_PRIMITIVES,
} from '../gramjsBuilders';
import { buildInputPasskeyCredential } from '../gramjsBuilders/passkeys';
import { addPhotoToLocalDb } from '../helpers/localDb';
import localDb from '../localDb';
import { getClient, invokeRequest, uploadFile } from './client';

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
    firstName,
    lastName,
    about,
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
  } catch (err: unknown) {
    if (err instanceof RPCError && ACCEPTABLE_USERNAME_ERRORS.has(err.errorMessage)) {
      return {
        result: false,
        error: err.errorMessage,
      };
    }

    throw err;
  }
}

export function updateUsername(username: string) {
  return invokeRequest(new GramJs.account.UpdateUsername({ username }), {
    shouldReturnTrue: true,
  });
}

export function updateBirthday(birthday?: ApiBirthday) {
  return invokeRequest(new GramJs.account.UpdateBirthday({
    birthday: birthday ? new GramJs.Birthday({
      day: birthday.day,
      month: birthday.month,
      year: birthday.year,
    }) : undefined,
  }), {
    shouldReturnTrue: true,
  });
}

export async function updateProfilePhoto(photo?: ApiPhoto, isFallback?: boolean) {
  const photoId = photo && buildInputPhoto(photo);
  const result = await invokeRequest(new GramJs.photos.UpdateProfilePhoto({
    id: photoId || new GramJs.InputPhotoEmpty(),
    ...(isFallback ? { fallback: true } : undefined),
  }));
  if (!result) return undefined;

  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
      photo: buildApiPhoto(result.photo),
    };
  }
  return undefined;
}

export async function uploadProfilePhoto(
  file: File, isFallback?: boolean, isVideo = false, videoTs = 0, bot?: ApiUser,
) {
  const inputFile = await uploadFile(file);
  const result = await invokeRequest(new GramJs.photos.UploadProfilePhoto({
    ...(bot ? { bot: buildInputUser(bot.id, bot.accessHash) } : undefined),
    ...(isVideo ? { video: inputFile, videoStartTs: videoTs } : { file: inputFile }),
    ...(isFallback ? { fallback: true } : undefined),
  }));

  if (!result) return undefined;

  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
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
    userId: buildInputUser(user.id, user.accessHash),
    file: inputFile,
    ...(isSuggest ? { suggest: true } : { save: true }),
  }));

  if (!result) return undefined;

  if (result.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(result.photo);
    return {
      photo: buildApiPhoto(result.photo),
    };
  }

  return {
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
    offset: DEFAULT_PRIMITIVES.INT,
    limit: BLOCKED_LIST_LIMIT,
  }));
  if (!result) {
    return undefined;
  }

  return {
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

  return {
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

  return result.updates.reduce((acc, update) => {
    if (!(update instanceof GramJs.UpdateNotifySettings && update.peer instanceof GramJs.NotifyPeer)) {
      return acc;
    }

    const peerId = getApiChatIdFromMtpPeer(update.peer.peer);

    acc[peerId] = buildApiPeerNotifySettings(update.notifySettings);

    return acc;
  }, {} as Record<string, ApiPeerNotifySettings>);
}

export async function fetchContactSignUpSetting() {
  const hasContactJoinedNotifications = await invokeRequest(new GramJs.account.GetContactSignUpNotification());

  return hasContactJoinedNotifications;
}

export async function fetchNotifyDefaultSettings() {
  const [
    usersSettings,
    groupsSettings,
    channelsSettings,
  ] = await Promise.all([
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

  if (!usersSettings || !groupsSettings || !channelsSettings) {
    return undefined;
  }

  return {
    users: buildApiPeerNotifySettings(usersSettings),
    groups: buildApiPeerNotifySettings(groupsSettings),
    channels: buildApiPeerNotifySettings(channelsSettings),
  };
}

export function updateContactSignUpNotification(isSilent: boolean) {
  return invokeRequest(new GramJs.account.SetContactSignUpNotification({ silent: isSilent }));
}

export function updateNotificationSettings(peerType: ApiNotifyPeerType, {
  isMuted,
  shouldShowPreviews,
}: {
  isMuted?: boolean;
  shouldShowPreviews?: boolean;
}) {
  let peer: GramJs.TypeInputNotifyPeer;
  if (peerType === 'users') {
    peer = new GramJs.InputNotifyUsers();
  } else if (peerType === 'groups') {
    peer = new GramJs.InputNotifyChats();
  } else {
    peer = new GramJs.InputNotifyBroadcasts();
  }

  const settings = {
    showPreviews: shouldShowPreviews,
    muteUntil: isMuted ? MUTE_INDEFINITE_TIMESTAMP : UNMUTE_TIMESTAMP,
  };

  return invokeRequest(new GramJs.account.UpdateNotifySettings({
    peer,
    settings: new GramJs.InputPeerNotifySettings(settings),
  }));
}

export async function fetchLangPack({
  langPack,
  langCode,
}: {
  langPack: string;
  langCode: string;
}) {
  const result = await invokeRequest(new GramJs.langpack.GetLangPack({
    langPack,
    langCode,
  }));
  if (!result) {
    return undefined;
  }

  const { strings, keysToRemove } = buildLangStrings(result.strings);

  return {
    version: result.version,
    strings,
    keysToRemove,
  };
}

export async function fetchLangDifference({
  langPack,
  langCode,
  fromVersion,
}: {
  langPack: string;
  langCode: string;
  fromVersion: number;
}) {
  const result = await invokeRequest(new GramJs.langpack.GetDifference({
    langPack,
    langCode,
    fromVersion,
  }));
  if (!result) {
    return undefined;
  }

  const { strings, keysToRemove } = buildLangStrings(result.strings);

  return {
    version: result.version,
    strings,
    keysToRemove,
  };
}

export async function fetchLanguages(): Promise<ApiLanguage[] | undefined> {
  const result = await invokeRequest(new GramJs.langpack.GetLanguages({
    langPack: LANG_PACK,
  }));
  if (!result) {
    return undefined;
  }

  return result.map(buildApiLanguage);
}

export async function fetchLanguage({
  langPack,
  langCode,
}: {
  langPack: string;
  langCode: string;
}): Promise<ApiLanguage | undefined> {
  const result = await invokeRequest(new GramJs.langpack.GetLanguage({
    langPack,
    langCode,
  }));
  if (!result) {
    return undefined;
  }

  return buildApiLanguage(result);
}

export async function fetchLangStrings({
  langPack,
  langCode,
  keys,
}: {
  langPack: string;
  langCode: string;
  keys: string[];
}) {
  const result = await invokeRequest(new GramJs.langpack.GetStrings({
    langPack,
    langCode,
    keys,
  }));
  if (!result) {
    return undefined;
  }

  return buildLangStrings(result);
}

export async function oldFetchLangPack({ sourceLangPacks, langCode }: {
  sourceLangPacks: typeof LANG_PACKS;
  langCode: string;
}) {
  const results = await Promise.all(sourceLangPacks.map((langPack) => {
    return invokeRequest(new GramJs.langpack.GetLangPack({
      langPack,
      langCode: BETA_LANG_CODES.includes(langCode) ? `${langCode}-raw` : langCode,
    }));
  }));

  const collections = results.filter(Boolean).map(oldBuildLangPack);
  if (!collections.length) {
    return undefined;
  }

  return { langPack: Object.assign({}, ...collections.reverse()) as typeof collections[0] };
}

export async function fetchPrivacySettings(privacyKey: ApiPrivacyKey) {
  const key = buildInputPrivacyKey(privacyKey);
  if (!key) return undefined;

  const result = await invokeRequest(new GramJs.account.GetPrivacy({ key }));

  if (!result) {
    return undefined;
  }

  return {
    rules: buildPrivacyRules(result.rules),
  };
}

export function registerDevice(token: string) {
  const client = getClient();
  const secret = client.session.getAuthKey().getKey()!;
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
  if (!key) return undefined;

  const result = await invokeRequest(new GramJs.account.SetPrivacy({ key, rules: privacyRules }));

  if (!result) {
    return undefined;
  }

  return {
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

export async function fetchPeerColors(hash?: number) {
  const result = await invokeRequest(new GramJs.help.GetPeerColors({
    hash: hash ?? DEFAULT_PRIMITIVES.INT,
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

export async function fetchPeerProfileColors(hash?: number) {
  const result = await invokeRequest(new GramJs.help.GetPeerProfileColors({
    hash: hash ?? DEFAULT_PRIMITIVES.INT,
  }));
  if (!result) return undefined;

  const colors = buildApiPeerProfileColors(result);
  if (!colors) return undefined;

  const newHash = result instanceof GramJs.help.PeerColors ? result.hash : undefined;

  return {
    colors,
    hash: newHash,
  };
}

export async function fetchTimezones(hash?: number) {
  const result = await invokeRequest(new GramJs.help.GetTimezonesList({
    hash: hash ?? DEFAULT_PRIMITIVES.INT,
  }));
  if (!result || result instanceof GramJs.help.TimezonesListNotModified) return undefined;

  const timezones = result.timezones.map(buildApiTimezone);

  return {
    timezones,
    hash: result.hash,
  };
}

export async function fetchCountryList({ langCode = 'en' }: { langCode?: string }) {
  const countryList = await invokeRequest(new GramJs.help.GetCountriesList({
    langCode,
    hash: DEFAULT_PRIMITIVES.INT,
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
    shouldHideReadMarks: Boolean(result.hideReadMarks),
    shouldNewNonContactPeersRequirePremium: Boolean(result.newNoncontactPeersRequirePremium),
    nonContactPeersPaidStars: toJSNumber(result.noncontactPeersPaidStars),
    shouldDisplayGiftsButton: Boolean(result.displayGiftsButton),
    disallowedGifts: result.disallowedGifts && buildApiDisallowedGiftsSettings(result.disallowedGifts),
  };
}

export async function updateGlobalPrivacySettings({
  shouldArchiveAndMuteNewNonContact,
  shouldHideReadMarks,
  shouldNewNonContactPeersRequirePremium,
  nonContactPeersPaidStars,
  shouldDisplayGiftsButton,
  disallowedGifts,
}: {
  shouldArchiveAndMuteNewNonContact?: boolean;
  shouldHideReadMarks?: boolean;
  shouldNewNonContactPeersRequirePremium?: boolean;
  nonContactPeersPaidStars?: number | null;
  shouldDisplayGiftsButton?: boolean;
  disallowedGifts?: ApiDisallowedGiftsSettings;
}) {
  const result = await invokeRequest(new GramJs.account.SetGlobalPrivacySettings({
    settings: new GramJs.GlobalPrivacySettings({
      ...(shouldArchiveAndMuteNewNonContact && { archiveAndMuteNewNoncontactPeers: true }),
      ...(shouldHideReadMarks && { hideReadMarks: true }),
      ...(shouldNewNonContactPeersRequirePremium && { newNoncontactPeersRequirePremium: true }),
      displayGiftsButton: shouldDisplayGiftsButton || undefined,
      noncontactPeersPaidStars: BigInt(nonContactPeersPaidStars || 0),
      disallowedGifts: disallowedGifts && buildDisallowedGiftsSettings(disallowedGifts),
    }),
  }));

  if (!result) {
    return undefined;
  }

  return {
    shouldArchiveAndMuteNewNonContact: Boolean(result.archiveAndMuteNewNoncontactPeers),
    shouldHideReadMarks: Boolean(result.hideReadMarks),
    shouldNewNonContactPeersRequirePremium: Boolean(result.newNoncontactPeersRequirePremium),
    nonContactPeersPaidStars: toJSNumber(result.noncontactPeersPaidStars),
    shouldDisplayGiftsButton,
    disallowedGifts,
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
      channel: buildInputChannel(chatId, accessHash),
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
      channel: buildInputChannel(chatId, accessHash),
      order: usernames,
    }));
  }

  return invokeRequest(new GramJs.account.ReorderUsernames({
    order: usernames,
  }));
}

export async function fetchPasskeys() {
  const result = await invokeRequest(new GramJs.account.GetPasskeys());
  if (!result) {
    return undefined;
  }

  return {
    passkeys: result.passkeys.map(buildApiPasskey),
  };
}

export async function initPasskeyRegistration() {
  const result = await invokeRequest(new GramJs.account.InitPasskeyRegistration());
  if (!result) {
    return undefined;
  }

  try {
    return JSON.parse(result.options.data) as ApiPasskeyRegistrationOption;
  } catch (err: unknown) {
    if (DEBUG) {
      // eslint-disable-next-line no-console
      console.warn('Failed to parse passkey registration options:', err);
    }
  }
  return undefined;
}

export async function registerPasskey(credentialJson: PublicKeyCredentialJSON) {
  const result = await invokeRequest(new GramJs.account.RegisterPasskey({
    credential: buildInputPasskeyCredential(credentialJson),
  }));
  if (!result) {
    return undefined;
  }

  return buildApiPasskey(result);
}

export function deletePasskey({ id }: { id: string }) {
  return invokeRequest(new GramJs.account.DeletePasskey({ id }), {
    shouldReturnTrue: true,
  });
}
