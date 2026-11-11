import { getActions, getGlobal, getPromiseActions } from '../global';

import type { SettingsAction } from '../types';
import type { RegularLangKey } from '../types/language';
import { SettingsScreens } from '../types';

import { FAQ_URL, PRIVACY_URL, TON_CURRENCY_CODE } from '../config';
import {
  selectIsWallpaperUploading, selectTabState, selectTheme, selectUserFullInfo,
} from '../global/selectors';
import { purgeClearableCache } from './cacheApi';
import { getCurrentTabId } from './establishMultitabRole';
import { validateFiles } from './files';
import { openSystemFilesDialog } from './systemFilesDialog';
import { buildDefaultWallpaperSettings } from './wallpaper';
import { clearWidgetStorage } from './widgetStorage';

const WALLPAPER_FILE_TYPES = 'image/jpeg';

const SETTINGS_ACTIONS: [SettingsScreens, RegularLangKey, SettingsAction][] = [
  [SettingsScreens.Main, 'WalletMenuItem', 'openWallet'],
  [SettingsScreens.Main, 'TelegramPremium', 'openPremium'],
  [SettingsScreens.Main, 'MenuStars', 'openStars'],
  [SettingsScreens.Main, 'GramEarnings', 'openTon'],
  [SettingsScreens.Main, 'MenuSendGift', 'sendGift'],
  [SettingsScreens.Main, 'AskAQuestion', 'askQuestion'],
  [SettingsScreens.Main, 'MenuTelegramFaq', 'openFaq'],
  [SettingsScreens.Main, 'MenuPrivacyPolicy', 'openPrivacyPolicy'],
  [SettingsScreens.Main, 'LogOutTitle', 'logOut'],
  [SettingsScreens.EditProfile, 'SettingsBirthday', 'setBirthday'],
  [SettingsScreens.GeneralChatBackground, 'UploadImage', 'uploadWallpaper'],
  [SettingsScreens.GeneralChatBackground, 'ThemeResetToDefaults', 'resetWallpaper'],
  [SettingsScreens.DataStorage, 'SettingsDataClearMediaCache', 'clearMediaCache'],
  [SettingsScreens.ActiveSessions, 'TerminateAllSessions', 'terminateAllSessions'],
  [SettingsScreens.ActiveWebsites, 'AuthSessionsLogOutApplications', 'terminateAllWebSessions'],
  [SettingsScreens.Privacy, 'SettingsItemPrivacyPasskeys', 'openPasskeys'],
  [SettingsScreens.Privacy, 'DeleteAccountIfAwayFor', 'setAccountTtl'],
];

export function getSettingsAction(screen: SettingsScreens, langKey: RegularLangKey) {
  return SETTINGS_ACTIONS.find(([actionScreen, actionLangKey]) => (
    actionScreen === screen && actionLangKey === langKey
  ))?.[2];
}

export function runSettingsAction(action: SettingsAction, tabId = getCurrentTabId()) {
  const actions = getActions();

  switch (action) {
    case 'openWallet':
      actions.openWalletModal({ tabId });
      break;
    case 'openPremium':
      actions.openPremiumModal({ tabId });
      break;
    case 'openStars':
      actions.openStarsBalanceModal({ tabId });
      break;
    case 'openTon':
      actions.openStarsBalanceModal({ currency: TON_CURRENCY_CODE, tabId });
      break;
    case 'sendGift':
      actions.openGiftRecipientPicker({ tabId });
      break;
    case 'openFaq':
      actions.openUrl({ url: FAQ_URL, tabId });
      break;
    case 'openPrivacyPolicy':
      actions.openUrl({ url: PRIVACY_URL, tabId });
      break;
    case 'uploadWallpaper':
      openWallpaperUpload(tabId);
      break;
    case 'resetWallpaper':
      resetWallpaper();
      break;
    case 'clearMediaCache':
      clearMediaCache(tabId);
      break;
    case 'openPasskeys':
      if (getGlobal().settings.passkeys) {
        openPasskeys(tabId);
      } else {
        void runAfterLoading(tabId, () => getPromiseActions().loadPasskeys(), () => openPasskeys(tabId));
      }
      break;
    case 'setBirthday':
      openBirthdaySetup(tabId);
      break;
    case 'setAccountTtl':
      void runAfterLoading(tabId, () => getPromiseActions().loadAccountDaysTtl(), () => openAccountTtlSetup(tabId));
      break;
    default:
      actions.openSettingsConfirmation({ confirmation: action, tabId });
  }
}

function openWallpaperUpload(tabId: number) {
  getActions().openSettingsScreen({ screen: SettingsScreens.GeneralChatBackground, tabId });
  if (selectIsWallpaperUploading(getGlobal())) return;

  openWallpaperFileDialog();
}

export function openWallpaperFileDialog() {
  openSystemFilesDialog(WALLPAPER_FILE_TYPES, (e) => {
    const validatedFiles = validateFiles((e.target as HTMLInputElement).files);
    if (validatedFiles?.length) getActions().uploadWallpaper(validatedFiles[0]);
  }, true);
}

export function resetWallpaper() {
  const theme = selectTheme(getGlobal());
  getActions().setThemeSettings({ theme, ...buildDefaultWallpaperSettings(theme) });
}

export function clearMediaCache(tabId?: number) {
  purgeClearableCache();
  // Widgets' storage goes with the cache, as the widget spec asks and tdesktop does
  clearWidgetStorage();
  getActions().clearMessageWidgetStorage();
  getActions().showNotification({
    message: { key: 'SettingsDataClearMediaDone' },
    tabId,
  });
}

async function runAfterLoading(tabId: number, load: () => Promise<void>, callback: NoneToVoidFunction) {
  const { contentKey, settingsScreen } = selectTabState(getGlobal(), tabId).leftColumn;
  await load();

  const { leftColumn } = selectTabState(getGlobal(), tabId);
  if (leftColumn.contentKey !== contentKey || leftColumn.settingsScreen !== settingsScreen) return;

  callback();
}

function openPasskeys(tabId: number) {
  const { openPasskeyModal, openSettingsScreen } = getActions();
  const { passkeys } = getGlobal().settings;
  if (!passkeys) {
    openSettingsScreen({
      screen: SettingsScreens.Privacy,
      highlight: { langKey: 'SettingsItemPrivacyPasskeys' },
      tabId,
    });
    return;
  }

  if (passkeys.length) {
    openSettingsScreen({ screen: SettingsScreens.Passkeys, tabId });
  } else {
    openPasskeyModal({ tabId });
  }
}

function openBirthdaySetup(tabId: number) {
  const global = getGlobal();
  const currentBirthday = global.currentUserId ? selectUserFullInfo(global, global.currentUserId)?.birthday : undefined;
  getActions().openBirthdaySetupModal({ currentBirthday, tabId });
}

function openAccountTtlSetup(tabId: number) {
  const { accountDaysTtl } = getGlobal().settings;
  if (accountDaysTtl) getActions().openDeleteAccountModal({ days: accountDaysTtl, tabId });
}
