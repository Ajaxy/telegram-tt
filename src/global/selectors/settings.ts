import type { GlobalState } from '../types';

import { ACCOUNT_SLOT, getAccountsInfo } from '../../util/multiaccount';
import { selectSharedSettings } from './sharedState';

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
  return selectSharedSettings(global).language.replace('-raw', '');
}

export function selectCanSetPasscode<T extends GlobalState>(global: T) {
  // TODO[passcode]: remove this when multiacc passcode is implemented
  const accounts = getAccountsInfo();
  return global.auth.rememberMe && !ACCOUNT_SLOT && Object.keys(accounts).length === 1;
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
