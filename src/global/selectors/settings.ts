import type { GlobalState } from '../types';
import { SettingsScreens } from '../../types';

import {
  IS_SNAP_EFFECT_SUPPORTED, IS_TRANSLATION_SUPPORTED, IS_WEBAUTHN_SUPPORTED,
} from '../../util/browser/windowEnvironment';
import { selectCurrentLimit } from './limits';
import { selectSharedSettings } from './sharedState';
import {
  selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
  selectIsGiveawayGiftsPurchaseAvailable,
  selectIsPremiumPurchaseBlocked,
} from './users';

export function selectNotifySettings<T extends GlobalState>(global: T) {
  return global.settings.byKey;
}

export function selectNotifyDefaults<T extends GlobalState>(global: T) {
  return global.settings.notifyDefaults;
}

export function selectNotifyException<T extends GlobalState>(global: T, chatId: string) {
  return global.chats.notifyExceptionById?.[chatId];
}

export function selectLanguageCode<T extends GlobalState>(global: T) {
  const { language, languages, customLanguages } = selectSharedSettings(global);
  const languageInfo = customLanguages?.find(({ langCode }) => langCode === language)
    || languages?.find(({ langCode }) => langCode === language);
  return languageInfo?.pluralCode || language.replace('-raw', '');
}

export function selectCanSetPasscode<T extends GlobalState>(global: T) {
  return Boolean(global.auth.rememberMe);
}

export function selectAvailableSettingsScreen<T extends GlobalState>(global: T, screen: SettingsScreens) {
  switch (screen) {
    case SettingsScreens.PasscodeDisabled:
    case SettingsScreens.PasscodeEnabled:
      if (!selectCanSetPasscode(global)) return undefined;
      return global.passcode.hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled;
    case SettingsScreens.TwoFaDisabled:
    case SettingsScreens.TwoFaEnabled: {
      const { hasPassword } = global.settings.byKey;
      if (hasPassword === undefined) return undefined;
      return hasPassword ? SettingsScreens.TwoFaEnabled : SettingsScreens.TwoFaDisabled;
    }
    case SettingsScreens.ActiveWebsites:
      return global.activeWebSessions.orderedHashes.length ? screen : undefined;
    case SettingsScreens.AutoDeleteMessages:
      if (selectIsCurrentUserFrozen(global) || global.settings.byKey.defaultHistoryTtl === undefined) return undefined;
      return screen;
    case SettingsScreens.DoNotTranslate: {
      const { canTranslate, canTranslateChats } = global.settings.byKey;
      const isTranslationEnabled = canTranslate || (canTranslateChats && selectIsCurrentUserPremium(global));
      return IS_TRANSLATION_SUPPORTED && isTranslationEnabled ? screen : undefined;
    }
    case SettingsScreens.QuickReaction:
      return global.config?.defaultReaction ? screen : undefined;
    default:
      return screen;
  }
}

export function selectSettingsSearchFlags<T extends GlobalState>(global: T) {
  const { settings: { byKey: { hasPassword, canChangeSensitive }, passkeys, privacy }, appConfig } = global;
  const hasPasscode = Boolean(global.passcode.hasPasscode);
  const sessionsCount = global.activeSessions.orderedHashes.length;
  const lastSeenVisibility = privacy.lastSeen?.visibility;
  const isPremium = selectIsCurrentUserPremium(global);

  return {
    isSnapEffectSupported: IS_SNAP_EFFECT_SUPPORTED,
    canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
    isGiveawayAvailable: selectIsGiveawayGiftsPurchaseAvailable(global),
    isPasswordStateKnown: hasPassword !== undefined,
    hasPassword,
    hasPasscode,
    canSetPasscode: selectCanSetPasscode(global),
    canUnlockWithPasskey: hasPasscode && Boolean(IS_WEBAUTHN_SUPPORTED),
    areSessionsLoaded: sessionsCount > 0,
    hasOtherSessions: sessionsCount > 1,
    hasWebSessions: global.activeWebSessions.orderedHashes.length > 0,
    arePasskeysAvailable: appConfig.arePasskeysAvailable,
    hasPasskeys: Boolean(appConfig.arePasskeysAvailable && passkeys?.length),
    canSetAutoDelete: selectAvailableSettingsScreen(global, SettingsScreens.AutoDeleteMessages) !== undefined,
    canChangeSensitive,
    canDisplayAutoarchiveSetting: Boolean(appConfig.canDisplayAutoarchiveSetting || isPremium),
    canCreateFolder: !isPremium
      || Object.keys(global.chatFolders.byId).length < selectCurrentLimit(global, 'dialogFilters') - 1,
    canHideReadTime: lastSeenVisibility === 'contacts' || lastSeenVisibility === 'nobody',
    areStickerSetsLoaded: Boolean(global.stickers.added.setIds),
    areCustomEmojiSetsLoaded: Boolean(global.customEmojis.added.setIds),
    isQuickReactionAvailable: selectAvailableSettingsScreen(global, SettingsScreens.QuickReaction) !== undefined,
    isDoNotTranslateAvailable: selectAvailableSettingsScreen(global, SettingsScreens.DoNotTranslate) !== undefined,
  };
}

export function selectTranslationLanguage<T extends GlobalState>(global: T) {
  return global.settings.byKey.translationLanguage || selectLanguageCode(global);
}

export function selectNewNoncontactPeersRequirePremium<T extends GlobalState>(global: T) {
  return global.settings.byKey.shouldNewNonContactPeersRequirePremium;
}

export function selectNonContactPeersPaidStars<T extends GlobalState>(global: T) {
  return global.settings.byKey.nonContactPeersPaidStars;
}

export function selectShouldHideReadMarks<T extends GlobalState>(global: T) {
  return global.settings.byKey.shouldHideReadMarks;
}

export function selectSettingsKeys<T extends GlobalState>(global: T) {
  return global.settings.byKey;
}

export function selectTimezones<T extends GlobalState>(global: T) {
  return global.timezones?.byId;
}
