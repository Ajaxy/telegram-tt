import type { selectSettingsSearchFlags } from '../../../../global/selectors';
import type { IconName } from '../../../../types/icons';
import type { RegularLangKey } from '../../../../types/language';
import type { IconBackdropColor } from '../../../gili/primitives/IconBackdrop';
import { SettingsScreens } from '../../../../types';

import { IS_IOS, IS_MAC_OS } from '../../../../util/browser/windowEnvironment';

export type SettingsSearchFlag =
  'isDesktopLayout' | 'canSendWithKeyboard' | keyof ReturnType<typeof selectSettingsSearchFlags>;

export type SettingsSearchSection = {
  screen: SettingsScreens;
  parent: SettingsScreens;
  titleKey: RegularLangKey;
  aliasKey?: RegularLangKey;
  keywordsKey?: RegularLangKey;
  icon?: IconName;
  iconBg?: IconBackdropColor;
  requires?: SettingsSearchFlag;
  screenWhen?: {
    flag: SettingsSearchFlag;
    screen: SettingsScreens;
  };
};

type SettingsSearchEntry = {
  screen: SettingsScreens;
  titleKey: RegularLangKey;
  keywordsKey?: RegularLangKey;
  icon?: IconName;
  iconBg?: IconBackdropColor;
  requires?: SettingsSearchFlag;
  isInHeaderMenu?: boolean;
};

type EntryOptions = Omit<SettingsSearchEntry, 'screen' | 'titleKey'>;

const PRIVACY_VISIBILITY_SCREENS = [
  SettingsScreens.PrivacyPhoneNumber,
  SettingsScreens.PrivacyLastSeen,
  SettingsScreens.PrivacyProfilePhoto,
  SettingsScreens.PrivacyBio,
  SettingsScreens.PrivacyBirthday,
  SettingsScreens.PrivacyGifts,
  SettingsScreens.PrivacySavedMusic,
  SettingsScreens.PrivacyForwarding,
  SettingsScreens.PrivacyPhoneCall,
  SettingsScreens.PrivacyVoiceMessages,
  SettingsScreens.PrivacyGroupChats,
];

export const SETTINGS_SEARCH_SECTIONS: SettingsSearchSection[] = [
  {
    screen: SettingsScreens.EditProfile,
    parent: SettingsScreens.Main,
    titleKey: 'SettingsInformation',
    aliasKey: 'SettingsAccount',
    icon: 'account-filled',
    iconBg: 'blue',
  },
  {
    screen: SettingsScreens.General,
    parent: SettingsScreens.Main,
    titleKey: 'General',
    aliasKey: 'TelegramGeneralSettingsViewController',
    icon: 'settings-filled',
    iconBg: 'orange',
  },
  {
    screen: SettingsScreens.Notifications,
    parent: SettingsScreens.Main,
    titleKey: 'Notifications',
    keywordsKey: 'SettingsKeywordsNotifications',
    icon: 'notifications-filled',
    iconBg: 'red',
  },
  {
    screen: SettingsScreens.Privacy,
    parent: SettingsScreens.Main,
    titleKey: 'PrivacySettings',
    icon: 'lock-filled',
    iconBg: 'gray',
  },
  {
    screen: SettingsScreens.DataStorage,
    parent: SettingsScreens.Main,
    titleKey: 'DataSettings',
    keywordsKey: 'SettingsKeywordsDataStorage',
    icon: 'piechart-filled',
    iconBg: 'green',
  },
  {
    screen: SettingsScreens.Folders,
    parent: SettingsScreens.Main,
    titleKey: 'Filters',
    keywordsKey: 'SettingsKeywordsFolders',
    icon: 'folder-filled',
    iconBg: 'blue',
  },
  {
    screen: SettingsScreens.Performance,
    parent: SettingsScreens.Main,
    titleKey: 'MenuAnimations',
    keywordsKey: 'SettingsKeywordsPerformance',
    icon: 'animations-filled',
    iconBg: 'purple',
  },
  {
    screen: SettingsScreens.Stickers,
    parent: SettingsScreens.Main,
    titleKey: 'MenuStickers',
    keywordsKey: 'SettingsKeywordsStickers',
    icon: 'smile-filled',
    iconBg: 'pink',
  },
  {
    screen: SettingsScreens.Language,
    parent: SettingsScreens.Main,
    titleKey: 'Language',
    keywordsKey: 'SettingsKeywordsLanguage',
    icon: 'web-filled',
    iconBg: 'purple',
  },
  {
    screen: SettingsScreens.ActiveSessions,
    parent: SettingsScreens.Main,
    titleKey: 'SessionsTitle',
    keywordsKey: 'SettingsKeywordsSessions',
    icon: 'devices-filled',
    iconBg: 'blue',
  },

  {
    screen: SettingsScreens.GeneralChatBackground,
    parent: SettingsScreens.General,
    titleKey: 'ChatBackground',
    keywordsKey: 'SettingsKeywordsChatBackground',
  },
  {
    screen: SettingsScreens.GeneralChatBackgroundColor,
    parent: SettingsScreens.GeneralChatBackground,
    titleKey: 'SetColor',
  },
  {
    screen: SettingsScreens.QuickReaction,
    parent: SettingsScreens.Stickers,
    titleKey: 'DoubleTapSetting',
    requires: 'isQuickReactionAvailable',
  },
  {
    screen: SettingsScreens.CustomEmoji,
    parent: SettingsScreens.Stickers,
    titleKey: 'Emoji',
    aliasKey: 'StickersListEmojiItem',
  },
  {
    screen: SettingsScreens.DoNotTranslate,
    parent: SettingsScreens.Language,
    titleKey: 'DoNotTranslate',
    requires: 'isDoNotTranslateAvailable',
  },

  {
    screen: SettingsScreens.PrivacyBlockedUsers,
    parent: SettingsScreens.Privacy,
    titleKey: 'BlockedUsers',
    keywordsKey: 'SettingsKeywordsBlockedUsers',
  },
  {
    screen: SettingsScreens.PasscodeDisabled,
    parent: SettingsScreens.Privacy,
    titleKey: 'Passcode',
    keywordsKey: 'SettingsKeywordsPasscode',
    requires: 'canSetPasscode',
    screenWhen: { flag: 'hasPasscode', screen: SettingsScreens.PasscodeEnabled },
  },
  {
    screen: SettingsScreens.TwoFaDisabled,
    parent: SettingsScreens.Privacy,
    titleKey: 'TwoStepVerification',
    keywordsKey: 'SettingsKeywordsTwoStep',
    requires: 'isPasswordStateKnown',
    screenWhen: { flag: 'hasPassword', screen: SettingsScreens.TwoFaEnabled },
  },
  {
    screen: SettingsScreens.Passkeys,
    parent: SettingsScreens.Privacy,
    titleKey: 'SettingsPasskeyTitle',
    aliasKey: 'SettingsItemPrivacyPasskeys',
    keywordsKey: 'SettingsKeywordsPasskeys',
    requires: 'hasPasskeys',
  },
  {
    screen: SettingsScreens.ActiveWebsites,
    parent: SettingsScreens.Privacy,
    titleKey: 'OtherWebSessions',
    aliasKey: 'PrivacySettingsWebSessions',
    requires: 'hasWebSessions',
  },
  {
    screen: SettingsScreens.AutoDeleteMessages,
    parent: SettingsScreens.Privacy,
    titleKey: 'AutoDeleteMessages',
    keywordsKey: 'SettingsKeywordsAutoDelete',
    requires: 'canSetAutoDelete',
  },
  {
    screen: SettingsScreens.PrivacyPhoneNumber,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyPhone',
    aliasKey: 'PrivacyPhoneTitle',
  },
  {
    screen: SettingsScreens.PrivacyLastSeen,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyLastSeen',
    aliasKey: 'LastSeenTitle',
    keywordsKey: 'SettingsKeywordsLastSeen',
  },
  {
    screen: SettingsScreens.PrivacyProfilePhoto,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyProfilePhoto',
    aliasKey: 'PrivacyProfilePhotoTitle',
  },
  {
    screen: SettingsScreens.PrivacyBio,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyBio',
    aliasKey: 'PrivacyBioTitle',
  },
  {
    screen: SettingsScreens.PrivacyBirthday,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyBirthday',
    aliasKey: 'PrivacyBirthdayTitle',
  },
  {
    screen: SettingsScreens.PrivacyGifts,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyGifts',
    aliasKey: 'PrivacyGiftsTitle',
  },
  {
    screen: SettingsScreens.PrivacySavedMusic,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyMusic',
    aliasKey: 'PrivacyMusicTitle',
  },
  {
    screen: SettingsScreens.PrivacyForwarding,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyForwards',
    aliasKey: 'PrivacyForwardsTitle',
  },
  {
    screen: SettingsScreens.PrivacyPhoneCall,
    parent: SettingsScreens.Privacy,
    titleKey: 'Calls',
    aliasKey: 'WhoCanCallMe',
  },
  {
    screen: SettingsScreens.PrivacyVoiceMessages,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyVoiceMessages',
    aliasKey: 'PrivacyVoiceMessagesTitle',
  },
  {
    screen: SettingsScreens.PrivacyMessages,
    parent: SettingsScreens.Privacy,
    titleKey: 'PrivacyMessages',
    aliasKey: 'PrivacyMessagesTitle',
  },
  {
    screen: SettingsScreens.PrivacyGroupChats,
    parent: SettingsScreens.Privacy,
    titleKey: 'AutodownloadGroupChats',
    aliasKey: 'WhoCanAddMe',
  },
];

export const SETTINGS_SEARCH_ENTRIES: SettingsSearchEntry[] = [
  ...buildEntries(SettingsScreens.Main, ['TelegramPremium'], {
    requires: 'canBuyPremium', icon: 'star', iconBg: 'premium',
  }),
  ...buildEntries(SettingsScreens.Main, ['MenuStars'], { icon: 'stars-filled', iconBg: 'orange' }),
  ...buildEntries(SettingsScreens.Main, ['GramEarnings'], { icon: 'gram-filled', iconBg: 'blue' }),
  ...buildEntries(SettingsScreens.Main, ['MenuSendGift'], {
    requires: 'isGiveawayAvailable', icon: 'gift-filled', iconBg: 'orange',
  }),
  ...buildEntries(SettingsScreens.Main, ['AskAQuestion'], { icon: 'support-filled', iconBg: 'red' }),
  ...buildEntries(SettingsScreens.Main, ['MenuTelegramFaq'], { icon: 'help-filled', iconBg: 'blue' }),
  ...buildEntries(SettingsScreens.Main, ['MenuPrivacyPolicy'], { icon: 'privacy-policy-filled', iconBg: 'green' }),
  ...buildEntries(SettingsScreens.Main, ['LogOutTitle'], {
    keywordsKey: 'SettingsKeywordsLogOut', icon: 'logout', iconBg: 'gray', isInHeaderMenu: true,
  }),

  ...buildEntries(SettingsScreens.EditProfile, [
    'FirstName', 'LastName', 'UserBio', 'SettingsBirthday', 'Username', 'PersonalChannelTitle',
  ]),

  ...buildEntries(SettingsScreens.General, ['TextSize'], { keywordsKey: 'SettingsKeywordsTextSize' }),
  ...buildEntries(SettingsScreens.General, ['Theme'], { keywordsKey: 'SettingsKeywordsTheme' }),
  ...buildEntries(SettingsScreens.General, ['SettingsTimeFormat'], { keywordsKey: 'SettingsKeywordsTimeFormat' }),
  ...buildEntries(SettingsScreens.General, [
    'EmptyChatAppearanceLight', 'EmptyChatAppearanceDark', 'EmptyChatAppearanceSystem', 'SettingsTimeFormat12',
    'SettingsTimeFormat24', 'SettingsAutomaticTextReplacements', 'SettingsKeyboard',
  ]),
  ...buildEntries(SettingsScreens.General, [
    'SettingsSendEnter', IS_MAC_OS || IS_IOS ? 'SettingsSendCmdenter' : 'SettingsSendCtrlenter',
  ], { requires: 'canSendWithKeyboard' }),

  ...buildEntries(SettingsScreens.GeneralChatBackground, [
    'UploadImage', 'ThemeResetToDefaults', 'BackgroundPatternIntensity', 'BackgroundBlurred',
    'ChatBackgroundColorThemes',
  ]),

  ...buildEntries(SettingsScreens.Notifications, [
    'NotificationsWeb', 'NotificationsOffline', 'NotificationsSound', 'NotificationsForPrivateChats', 'MessagePreview',
    'NotificationsForGroups', 'NotificationsForChannels', 'ContactJoined', 'PinnedMessagesNotifications',
  ]),
  ...buildEntries(SettingsScreens.Notifications, ['AutodownloadPrivateChats'], {
    keywordsKey: 'SettingsKeywordsPrivateChats',
  }),
  ...buildEntries(SettingsScreens.Notifications, ['FilterGroups'], { keywordsKey: 'SettingsKeywordsGroups' }),
  ...buildEntries(SettingsScreens.Notifications, ['FilterChannels'], { keywordsKey: 'SettingsKeywordsChannels' }),

  ...buildEntries(SettingsScreens.DataStorage, [
    'AutoDownloadPhotosTitle', 'AutoDownloadVideosTitle', 'AutoDownloadFilesTitle', 'AutoDownloadSettingsContacts',
    'AutoDownloadSettingsPrivateChats', 'AutoDownloadSettingsGroupChats', 'AutoDownloadSettingsChannels',
    'AutoDownloadMaxFileSize', 'SettingsDataClearMediaCache',
  ]),

  ...buildEntries(SettingsScreens.Performance, [
    'SettingsPerformanceSliderTitle', 'SettingsPerformanceGranularTitle', 'SettingsPerformanceInterfaceAnimations',
    'SettingsPerformanceStickers', 'SettingsPerformanceMediaAutoplay', 'SettingsPerformancePageTransitions',
    'SettingsPerformanceSending', 'SettingsPerformanceMediaViewer', 'SettingsPerformanceComposer',
    'SettingsPerformanceContextAnimation', 'SettingsPerformanceContextBlur', 'SettingsPerformanceRightColumn',
    'SettingsPerformanceTextStreaming', 'SettingsPerformanceAnimatedEmoji', 'SettingsPerformanceLoopStickers',
    'SettingsPerformanceReactionEffects', 'SettingsPerformanceStickerEffects', 'SettingsPerformanceAutoplayGif',
    'SettingsPerformanceAutoplayVideo',
  ]),
  ...buildEntries(SettingsScreens.Performance, ['SettingsPerformanceThanos'], { requires: 'isSnapEffectSupported' }),

  ...buildEntries(SettingsScreens.Stickers, ['SuggestStickers', 'InstalledStickersDynamicPackOrder']),
  ...buildEntries(SettingsScreens.Stickers, ['ChooseStickerMyStickerSets'], { requires: 'areStickerSetsLoaded' }),
  ...buildEntries(SettingsScreens.CustomEmoji, ['SuggestAnimatedEmoji'], { requires: 'areCustomEmojiSetsLoaded' }),

  ...buildEntries(SettingsScreens.Language, [
    'ShowTranslateButton', 'ShowTranslateChatButton', 'LocalizationInterfaceLanguage',
  ]),

  ...buildEntries(SettingsScreens.Folders, ['ShowFolderTags']),
  ...buildEntries(SettingsScreens.Folders, ['TabsPosition', 'TabsPositionLeft', 'TabsPositionTop'], {
    requires: 'isDesktopLayout',
  }),

  ...buildEntries(SettingsScreens.ActiveSessions, ['TerminateOldSessionHeader', 'IfInactiveFor']),
  ...buildEntries(SettingsScreens.ActiveSessions, ['AuthSessionsCurrentSession'], { requires: 'areSessionsLoaded' }),
  ...buildEntries(SettingsScreens.ActiveSessions, ['TerminateAllSessions'], { requires: 'hasOtherSessions' }),
  ...buildEntries(SettingsScreens.ActiveWebsites, ['WebSessionsTitle', 'AuthSessionsLogOutApplications']),

  ...buildEntries(SettingsScreens.Privacy, [
    'PrivacyTitle', 'SettingsWindowSystem', 'SettingsTitleChatName', 'DeleteMyAccount', 'DeleteAccountIfAwayFor',
  ]),
  ...buildEntries(SettingsScreens.Privacy, ['SettingsSensitiveTitle', 'SettingsSensitiveDisableFiltering'], {
    requires: 'canChangeSensitive',
  }),
  ...buildEntries(SettingsScreens.Privacy, ['NewChatsFromNonContacts'], {
    requires: 'canDisplayAutoarchiveSetting',
  }),
  ...buildEntries(SettingsScreens.Privacy, ['ArchiveAndMute'], {
    requires: 'canDisplayAutoarchiveSetting', keywordsKey: 'SettingsKeywordsArchiveAndMute',
  }),
  ...buildEntries(SettingsScreens.Privacy, ['SettingsItemPrivacyPasskeys'], {
    requires: 'arePasskeysAvailable', keywordsKey: 'SettingsKeywordsPasskeys',
  }),

  ...PRIVACY_VISIBILITY_SCREENS.flatMap((screen) => (
    buildEntries(screen, ['P2PEverybody', 'P2PContacts', 'P2PNobody'])
  )),
  ...buildEntries(SettingsScreens.PrivacyLastSeen, ['HideReadTime'], { requires: 'canHideReadTime' }),
  ...buildEntries(SettingsScreens.PrivacyGifts, [
    'PrivacyDisplayGiftsButton', 'PrivacyAcceptedGiftTitle', 'PrivacyGiftLimitedEdition', 'PrivacyGiftUnlimited',
    'PrivacyGiftUnique', 'PrivacyGiftPremiumSubscription',
  ]),
  ...buildEntries(SettingsScreens.PrivacyPhoneCall, ['PrivacyP2P']),
  ...buildEntries(SettingsScreens.PrivacyMessages, [
    'P2PEverybody', 'PrivacyMessagesContactsAndPremium', 'PrivacyChargeForMessages',
  ]),

  ...buildEntries(SettingsScreens.AutoDeleteMessages, [
    'SetAutoDeleteTimer', 'SettingsItemPrivacyOff', 'SetCustomTime',
  ]),

  ...buildEntries(SettingsScreens.TwoFaEnabled, ['ChangePassword', 'TurnPasswordOff', 'SetRecoveryEmail'], {
    requires: 'hasPassword',
  }),
  ...buildEntries(SettingsScreens.PasscodeEnabled, [
    'PasscodeChange', 'PasscodeTurnOff', 'PasscodeLockScreenTitle', 'PasscodeKeepBackground', 'PasscodeAutoLockTitle',
    'PasscodeAutoLockDisabled', 'PasscodeAutoLock1Min', 'PasscodeAutoLock5Min', 'PasscodeAutoLock30Min',
    'PasscodeAutoLock1Hour',
  ], { requires: 'hasPasscode' }),
  ...buildEntries(SettingsScreens.PasscodeEnabled, ['PasscodePasskeyTitle'], { requires: 'canUnlockWithPasskey' }),
];

function buildEntries(
  screen: SettingsScreens, titleKeys: RegularLangKey[], options?: EntryOptions,
): SettingsSearchEntry[] {
  return titleKeys.map((titleKey) => ({ screen, titleKey, ...options }));
}
