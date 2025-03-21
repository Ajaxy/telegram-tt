import type { GlobalState } from '../types';

export function selectNotifyDefaults<T extends GlobalState>(global: T) {
  return global.settings.notifyDefaults;
}

export function selectNotifyException<T extends GlobalState>(global: T, chatId: string) {
  return global.chats.notifyExceptionById?.[chatId];
}

export function selectLanguageCode<T extends GlobalState>(global: T) {
  return global.settings.byKey.language.replace('-raw', '');
}

export function selectCanSetPasscode<T extends GlobalState>(global: T) {
  return global.authRememberMe;
}

export function selectTranslationLanguage<T extends GlobalState>(global: T) {
  return global.settings.byKey.translationLanguage || selectLanguageCode(global);
}

export function selectNewNoncontactPeersRequirePremium<T extends GlobalState>(global: T) {
  return global.settings.byKey.shouldNewNonContactPeersRequirePremium;
}

export function selectShouldHideReadMarks<T extends GlobalState>(global: T) {
  return global.settings.byKey.shouldHideReadMarks;
}

export function selectSettingsKeys<T extends GlobalState>(global: T) {
  return global.settings.byKey;
}
