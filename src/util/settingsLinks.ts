import type { GlobalState } from '../global/types';
import type { RegularLangKey } from '../types/language';
import { type SettingsHighlight, SettingsScreens } from '../types';

import { selectAvailableSettingsScreen, selectSettingsSearchFlags } from '../global/selectors';

type SettingsLinkOptions = Pick<SettingsHighlight, 'isInHeaderMenu'> & {
  requires?: keyof ReturnType<typeof selectSettingsSearchFlags>;
};

type SettingsLink = [screen: SettingsScreens, langKey?: RegularLangKey, options?: SettingsLinkOptions];

const LINK_PREFIX = 'tg://settings/';
const PATH_SEPARATOR = '/';

const SETTINGS_LINKS = new Map<string, SettingsLink>([
  ['search', [SettingsScreens.Search]],

  ['edit', [SettingsScreens.EditProfile]],
  ['edit/first-name', [SettingsScreens.EditProfile, 'FirstName']],
  ['edit/last-name', [SettingsScreens.EditProfile, 'LastName']],
  ['edit/bio', [SettingsScreens.EditProfile, 'UserBio']],
  ['edit/birthday', [SettingsScreens.EditProfile, 'SettingsBirthday']],
  ['edit/username', [SettingsScreens.EditProfile, 'Username']],
  ['edit/channel', [SettingsScreens.EditProfile, 'PersonalChannelTitle']],
  ['edit/log-out', [SettingsScreens.Main, 'LogOutTitle', { isInHeaderMenu: true }]],

  ['premium', [SettingsScreens.Main, 'TelegramPremium']],
  ['stars', [SettingsScreens.Main, 'MenuStars']],
  ['ton', [SettingsScreens.Main, 'GramEarnings']],
  ['send-gift', [SettingsScreens.Main, 'MenuSendGift']],

  ['devices', [SettingsScreens.ActiveSessions]],
  ['devices/terminate-sessions', [SettingsScreens.ActiveSessions, 'TerminateAllSessions']],
  ['devices/auto-terminate', [SettingsScreens.ActiveSessions, 'IfInactiveFor']],

  ['folders', [SettingsScreens.Folders]],
  ['folders/tab-view', [SettingsScreens.Folders, 'TabsPosition']],
  ['folders/show-tags', [SettingsScreens.Folders, 'ShowFolderTags']],
  ['folders/create', [SettingsScreens.Folders, 'CreateNewFilter', { requires: 'canCreateFolder' }]],

  ['notifications', [SettingsScreens.Notifications]],
  ['notifications/private-chats', [SettingsScreens.Notifications, 'AutodownloadPrivateChats']],
  ['notifications/private-chats/show', [SettingsScreens.Notifications, 'NotificationsForPrivateChats']],
  ['notifications/groups', [SettingsScreens.Notifications, 'FilterGroups']],
  ['notifications/groups/show', [SettingsScreens.Notifications, 'NotificationsForGroups']],
  ['notifications/channels', [SettingsScreens.Notifications, 'FilterChannels']],
  ['notifications/channels/show', [SettingsScreens.Notifications, 'NotificationsForChannels']],
  ['notifications/new-contacts', [SettingsScreens.Notifications, 'ContactJoined']],
  ['notifications/pinned-messages', [SettingsScreens.Notifications, 'PinnedMessagesNotifications']],

  ['privacy', [SettingsScreens.Privacy]],
  ['privacy/blocked', [SettingsScreens.PrivacyBlockedUsers]],
  ['privacy/active-websites', [SettingsScreens.ActiveWebsites]],
  ['privacy/active-websites/disconnect-all', [SettingsScreens.ActiveWebsites, 'AuthSessionsLogOutApplications']],
  ['privacy/passcode', [SettingsScreens.PasscodeDisabled]],
  ['privacy/passcode/disable', [SettingsScreens.PasscodeEnabled, 'PasscodeTurnOff']],
  ['privacy/passcode/change', [SettingsScreens.PasscodeEnabled, 'PasscodeChange']],
  ['privacy/passcode/auto-lock', [SettingsScreens.PasscodeEnabled, 'PasscodeAutoLockTitle']],
  ['privacy/2sv', [SettingsScreens.TwoFaDisabled]],
  ['privacy/2sv/change', [SettingsScreens.TwoFaEnabled, 'ChangePassword']],
  ['privacy/2sv/disable', [SettingsScreens.TwoFaEnabled, 'TurnPasswordOff']],
  ['privacy/2sv/change-email', [SettingsScreens.TwoFaEnabled, 'SetRecoveryEmail']],
  ['privacy/passkey', [
    SettingsScreens.Privacy, 'SettingsItemPrivacyPasskeys', { requires: 'arePasskeysAvailable' },
  ]],
  ['privacy/auto-delete', [SettingsScreens.AutoDeleteMessages]],
  ['privacy/auto-delete/set-custom', [SettingsScreens.AutoDeleteMessages, 'SetCustomTime']],
  ['privacy/phone-number', [SettingsScreens.PrivacyPhoneNumber]],
  ['privacy/last-seen', [SettingsScreens.PrivacyLastSeen]],
  ['privacy/last-seen/hide-read-time', [SettingsScreens.PrivacyLastSeen, 'HideReadTime']],
  ['privacy/profile-photos', [SettingsScreens.PrivacyProfilePhoto]],
  ['privacy/bio', [SettingsScreens.PrivacyBio]],
  ['privacy/birthday', [SettingsScreens.PrivacyBirthday]],
  ['privacy/gifts', [SettingsScreens.PrivacyGifts]],
  ['privacy/gifts/show-icon', [SettingsScreens.PrivacyGifts, 'PrivacyDisplayGiftsButton']],
  ['privacy/gifts/accepted-types', [SettingsScreens.PrivacyGifts, 'PrivacyAcceptedGiftTitle']],
  ['privacy/saved-music', [SettingsScreens.PrivacySavedMusic]],
  ['privacy/forwards', [SettingsScreens.PrivacyForwarding]],
  ['privacy/calls', [SettingsScreens.PrivacyPhoneCall]],
  ['privacy/calls/p2p', [SettingsScreens.PrivacyPhoneCall, 'PrivacyP2P']],
  ['privacy/voice', [SettingsScreens.PrivacyVoiceMessages]],
  ['privacy/messages', [SettingsScreens.PrivacyMessages]],
  ['privacy/invites', [SettingsScreens.PrivacyGroupChats]],
  ['privacy/archive-and-mute', [
    SettingsScreens.Privacy, 'ArchiveAndMute', { requires: 'canDisplayAutoarchiveSetting' },
  ]],
  ['privacy/self-destruct', [SettingsScreens.Privacy, 'DeleteAccountIfAwayFor']],

  ['data', [SettingsScreens.DataStorage]],
  ['data/auto-download/wifi/photos', [SettingsScreens.DataStorage, 'AutoDownloadPhotosTitle']],
  ['data/auto-download/wifi/videos', [SettingsScreens.DataStorage, 'AutoDownloadVideosTitle']],
  ['data/auto-download/wifi/files', [SettingsScreens.DataStorage, 'AutoDownloadFilesTitle']],
  ['data/storage/clear-cache', [SettingsScreens.DataStorage, 'SettingsDataClearMediaCache']],
  ['data/show-18-content', [
    SettingsScreens.Privacy, 'SettingsSensitiveDisableFiltering', { requires: 'canChangeSensitive' },
  ]],

  ['appearance', [SettingsScreens.General]],
  ['appearance/themes', [SettingsScreens.General, 'Theme']],
  ['appearance/night-mode', [SettingsScreens.General, 'EmptyChatAppearanceDark']],
  ['appearance/auto-night-mode', [SettingsScreens.General, 'EmptyChatAppearanceSystem']],
  ['appearance/text-size', [SettingsScreens.General, 'TextSize']],
  ['appearance/wallpapers', [SettingsScreens.GeneralChatBackground]],
  ['appearance/wallpapers/set', [SettingsScreens.GeneralChatBackgroundColor]],
  ['appearance/wallpapers/choose-photo', [SettingsScreens.GeneralChatBackground, 'UploadImage']],
  ['appearance/stickers-and-emoji', [SettingsScreens.Stickers]],
  ['appearance/stickers-and-emoji/emoji', [SettingsScreens.CustomEmoji]],
  ['appearance/stickers-and-emoji/emoji/suggest', [
    SettingsScreens.CustomEmoji, 'SuggestAnimatedEmoji', { requires: 'areCustomEmojiSetsLoaded' },
  ]],
  ['appearance/stickers-and-emoji/emoji/quick-reaction', [SettingsScreens.QuickReaction]],
  ['appearance/stickers-and-emoji/suggest-by-emoji', [SettingsScreens.Stickers, 'SuggestStickers']],
  ['appearance/stickers-and-emoji/dynamic-order', [SettingsScreens.Stickers, 'InstalledStickersDynamicPackOrder']],

  ['power-saving', [SettingsScreens.Performance]],
  ['power-saving/videos', [SettingsScreens.Performance, 'SettingsPerformanceAutoplayVideo']],
  ['power-saving/gifs', [SettingsScreens.Performance, 'SettingsPerformanceAutoplayGif']],
  ['power-saving/stickers', [SettingsScreens.Performance, 'SettingsPerformanceStickers']],
  ['power-saving/emoji', [SettingsScreens.Performance, 'SettingsPerformanceAnimatedEmoji']],
  ['power-saving/transitions', [SettingsScreens.Performance, 'SettingsPerformanceInterfaceAnimations']],

  ['language', [SettingsScreens.Language]],
  ['language/show-button', [SettingsScreens.Language, 'ShowTranslateButton']],
  ['language/translate-chats', [SettingsScreens.Language, 'ShowTranslateChatButton']],
  ['language/do-not-translate', [SettingsScreens.DoNotTranslate]],
]);

const SETTINGS_LINK_ALIASES = new Map([
  ['edit_profile', 'edit'],
  ['my-profile/edit', 'edit'],
  ['auto_delete', 'privacy/auto-delete'],
  ['phone_privacy', 'privacy/phone-number'],
  ['theme', 'appearance'],
  ['themes', 'appearance'],
  ['appearance/animations', 'power-saving'],
  ['appearance/stickers-and-emoji/emoji/dynamic-order', 'appearance/stickers-and-emoji/dynamic-order'],
]);

export function getSettingsLink(screen: SettingsScreens, langKey?: RegularLangKey) {
  for (const [path, [linkScreen, linkLangKey]] of SETTINGS_LINKS) {
    if (linkScreen === screen && linkLangKey === langKey) return `${LINK_PREFIX}${path}`;
  }

  return undefined;
}

export function resolveSettingsLink<T extends GlobalState>(global: T, path: string) {
  const segments = path.split(PATH_SEPARATOR);

  while (segments.length) {
    const linkPath = segments.join(PATH_SEPARATOR);
    const link = SETTINGS_LINKS.get(SETTINGS_LINK_ALIASES.get(linkPath) || linkPath);
    const target = link && buildTarget(global, link);
    if (target) return target;

    segments.pop();
  }

  return undefined;
}

function buildTarget<T extends GlobalState>(global: T, [linkScreen, langKey, options]: SettingsLink) {
  const screen = selectAvailableSettingsScreen(global, linkScreen);
  if (screen === undefined || (langKey && screen !== linkScreen)) return undefined;
  if (options?.requires && !selectSettingsSearchFlags(global)[options.requires]) return undefined;

  return {
    screen,
    highlight: langKey ? { langKey, isInHeaderMenu: options?.isInHeaderMenu } : undefined,
  };
}
