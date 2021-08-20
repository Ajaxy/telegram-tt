import { Api as GramJs } from '../../../lib/gramjs';

import { ApiSession, ApiWallpaper } from '../../types';
import { ApiPrivacySettings, ApiPrivacyKey, PrivacyVisibility } from '../../../types';

import { buildApiDocument } from './messages';
import { getApiChatIdFromMtpPeer } from './chats';
import { pick } from '../../../util/iteratees';
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
  let allowUserIds: number[] | undefined;
  let allowChatIds: number[] | undefined;
  let blockUserIds: number[] | undefined;
  let blockChatIds: number[] | undefined;

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
      allowUserIds = rule.users;
    } else if (rule instanceof GramJs.PrivacyValueDisallowUsers) {
      blockUserIds = rule.users;
    } else if (rule instanceof GramJs.PrivacyValueAllowChatParticipants) {
      allowChatIds = rule.chats.map((id) => -id);
    } else if (rule instanceof GramJs.PrivacyValueDisallowChatParticipants) {
      blockChatIds = rule.chats.map((id) => -id);
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
    silent, muteUntil, showPreviews, sound,
  } = notifySettings;

  return {
    chatId: getApiChatIdFromMtpPeer(peer),
    isMuted: silent || (typeof muteUntil === 'number' && getServerTime(serverTimeOffset) < muteUntil),
    ...(sound === '' && { isSilent: true }),
    ...(showPreviews !== undefined && { shouldShowPreviews: Boolean(showPreviews) }),
  };
}
