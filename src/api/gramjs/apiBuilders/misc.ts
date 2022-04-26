import { Api as GramJs } from '../../../lib/gramjs';

import {
  ApiCountry, ApiSession, ApiWallpaper,
} from '../../types';
import { ApiPrivacySettings, ApiPrivacyKey, PrivacyVisibility } from '../../../types';

import { buildApiDocument } from './messages';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { flatten, pick } from '../../../util/iteratees';
import { getServerTime } from '../../../util/serverTime';

export function buildApiWallpaper(wallpaper: GramJs.TypeWallPaper): ApiWallpaper | undefined {
  if (wallpaper instanceof GramJs.WallPaperNoFile) {
    // TODO: Plain color wallpapers
    return undefined;
  }

  const { slug } = wallpaper;

  const document = buildApiDocument(wallpaper.document);

  if (!document) {
    return undefined;
  }

  return {
    slug,
    document,
  };
}

export function buildApiSession(session: GramJs.Authorization): ApiSession {
  return {
    isCurrent: Boolean(session.current),
    isOfficialApp: Boolean(session.officialApp),
    isPasswordPending: Boolean(session.passwordPending),
    hash: String(session.hash),
    areCallsEnabled: !session.callRequestsDisabled,
    ...pick(session, [
      'deviceModel', 'platform', 'systemVersion', 'appName', 'appVersion', 'dateCreated', 'dateActive',
      'ip', 'country', 'region',
    ]),
  };
}

export function buildPrivacyKey(key: GramJs.TypePrivacyKey): ApiPrivacyKey | undefined {
  switch (key.className) {
    case 'PrivacyKeyPhoneNumber':
      return 'phoneNumber';
    case 'PrivacyKeyStatusTimestamp':
      return 'lastSeen';
    case 'PrivacyKeyProfilePhoto':
      return 'profilePhoto';
    case 'PrivacyKeyForwards':
      return 'forwards';
    case 'PrivacyKeyChatInvite':
      return 'chatInvite';
  }

  return undefined;
}

export function buildPrivacyRules(rules: GramJs.TypePrivacyRule[]): ApiPrivacySettings {
  let visibility: PrivacyVisibility | undefined;
  let allowUserIds: string[] | undefined;
  let allowChatIds: string[] | undefined;
  let blockUserIds: string[] | undefined;
  let blockChatIds: string[] | undefined;

  rules.forEach((rule) => {
    if (rule instanceof GramJs.PrivacyValueAllowAll) {
      visibility = visibility || 'everybody';
    } else if (rule instanceof GramJs.PrivacyValueAllowContacts) {
      visibility = visibility || 'contacts';
    } else if (rule instanceof GramJs.PrivacyValueDisallowContacts) {
      visibility = visibility || 'nonContacts';
    } else if (rule instanceof GramJs.PrivacyValueDisallowAll) {
      visibility = visibility || 'nobody';
    } else if (rule instanceof GramJs.PrivacyValueAllowUsers) {
      allowUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueDisallowUsers) {
      blockUserIds = rule.users.map((chatId) => buildApiPeerId(chatId, 'user'));
    } else if (rule instanceof GramJs.PrivacyValueAllowChatParticipants) {
      allowChatIds = rule.chats.map((chatId) => buildApiPeerId(chatId, 'chat'));
    } else if (rule instanceof GramJs.PrivacyValueDisallowChatParticipants) {
      blockChatIds = rule.chats.map((chatId) => buildApiPeerId(chatId, 'chat'));
    }
  });

  if (!visibility) {
    // disallow by default.
    visibility = 'nobody';
  }

  return {
    visibility,
    allowUserIds: allowUserIds || [],
    allowChatIds: allowChatIds || [],
    blockUserIds: blockUserIds || [],
    blockChatIds: blockChatIds || [],
  };
}

export function buildApiNotifyException(
  notifySettings: GramJs.TypePeerNotifySettings, peer: GramJs.TypePeer, serverTimeOffset: number,
) {
  const {
    silent, muteUntil, showPreviews, otherSound,
  } = notifySettings;

  const hasSound = Boolean(otherSound && !(otherSound instanceof GramJs.NotificationSoundNone));

  return {
    chatId: getApiChatIdFromMtpPeer(peer),
    isMuted: silent || (typeof muteUntil === 'number' && getServerTime(serverTimeOffset) < muteUntil),
    ...(!hasSound && { isSilent: true }),
    ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
  };
}

function buildApiCountry(country: GramJs.help.Country, code?: GramJs.help.CountryCode) {
  const {
    hidden, iso2, defaultName, name,
  } = country;
  const { countryCode, prefixes, patterns } = code || {};

  return {
    isHidden: hidden,
    iso2,
    defaultName,
    name,
    countryCode,
    prefixes,
    patterns,
  };
}

export function buildApiCountryList(countries: GramJs.help.Country[]) {
  const listByCode = flatten(
    countries
      .filter((country) => !country.hidden)
      .map((country) => (
        country.countryCodes.map((code) => buildApiCountry(country, code))
      )),
  )
    .sort((a: ApiCountry, b: ApiCountry) => (
      a.name ? a.name.localeCompare(b.name!) : a.defaultName.localeCompare(b.defaultName)
    ));

  const generalList = countries
    .filter((country) => !country.hidden)
    .map((country) => buildApiCountry(country))
    .sort((a, b) => (
      a.name ? a.name.localeCompare(b.name!) : a.defaultName.localeCompare(b.defaultName)
    ));

  return {
    phoneCodes: listByCode,
    general: generalList,
  };
}

export function buildJson(json: GramJs.TypeJSONValue): any {
  if (json instanceof GramJs.JsonNull) return undefined;
  if (json instanceof GramJs.JsonString
    || json instanceof GramJs.JsonBool
    || json instanceof GramJs.JsonNumber) return json.value;
  if (json instanceof GramJs.JsonArray) return json.value.map(buildJson);

  return json.value.reduce((acc: Record<string, any>, el) => {
    acc[el.key] = buildJson(el.value);
    return acc;
  }, {});
}
