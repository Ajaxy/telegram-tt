import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { AnimationLevel, ThemeKey } from '../../../types';
import { SettingsScreens } from '../../../types';

import {
  ANIMATION_LEVEL_MAX,
  ANIMATION_LEVEL_MIN,
  ARCHIVED_FOLDER_ID,
  BETA_CHANGELOG_URL,
  FEEDBACK_URL,
  IS_BETA,
  IS_TEST,
  PRODUCTION_HOSTNAME,
  WEB_VERSION_BASE,
} from '../../../config';
import {
  INITIAL_PERFORMANCE_STATE_MAX,
  INITIAL_PERFORMANCE_STATE_MED,
  INITIAL_PERFORMANCE_STATE_MIN,
} from '../../../global/initialState';
import {
  selectTabState, selectTheme, selectUser, selectWalletBotId,
} from '../../../global/selectors';
import { selectPremiumLimit } from '../../../global/selectors/limits';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_MULTIACCOUNT_SUPPORTED, IS_TAURI } from '../../../util/browser/globalEnvironment';
import { getPromptInstall } from '../../../util/installPrompt';
import { switchPermanentWebVersion } from '../../../util/permanentWebVersion';
import { getSystemTheme } from '../../../util/systemTheme';

import useFlag from '../../../hooks/useFlag';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AttachBotItem from '../../middle/composer/AttachBotItem';
import ConfirmDialog from '../../ui/ConfirmDialog';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import NestedMenuItem from '../../ui/NestedMenuItem';
import Switcher from '../../ui/Switcher';
import Toggle from '../../ui/Toggle';
import AccountMenuItems from './AccountMenuItems';

type OwnProps = {
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onBotMenuOpened: NoneToVoidFunction;
  onBotMenuClosed: NoneToVoidFunction;
  onSwitchAccount: (url: string) => void;
  footer?: string;
};

type StateProps = {
  animationLevel: AnimationLevel;
  currentUser?: ApiUser;
  theme: ThemeKey;
  canInstall?: boolean;
  attachBots: GlobalState['attachMenu']['bots'];
  accountsTotalLimit: number;
  hasPasscode?: boolean;
  isWalletAvailable?: boolean;
  walletBotId?: string;
} & Pick<GlobalState, 'currentUserId' | 'archiveSettings'>;

const LeftSideMenuItems = ({
  currentUserId,
  archiveSettings,
  animationLevel,
  theme,
  canInstall,
  attachBots,
  currentUser,
  accountsTotalLimit,
  hasPasscode,
  isWalletAvailable,
  walletBotId,
  onSelectArchived,
  onSelectContacts,
  onSelectSettings,
  onBotMenuOpened,
  onBotMenuClosed,
  onSwitchAccount,
  footer,
}: OwnProps & StateProps) => {
  const {
    openChat,
    setSharedSettingOption,
    updatePerformanceSettings,
    openChatByUsername,
    openUrl,
    openChatWithInfo,
    openSettingsScreen,
    openWalletModal,
  } = getActions();
  const lang = useLang();
  const [isSwitchToWebKDialogOpen, openSwitchToWebKDialog, closeSwitchToWebKDialog] = useFlag();

  const animationLevelValue = animationLevel !== ANIMATION_LEVEL_MIN
    ? (animationLevel === ANIMATION_LEVEL_MAX ? 'max' : 'mid') : 'min';

  const withOtherVersions = !IS_TAURI && (window.location.hostname === PRODUCTION_HOSTNAME || IS_TEST);

  const archivedUnreadChatsCount = useFolderManagerForUnreadCounters()[ARCHIVED_FOLDER_ID]?.chatsCount || 0;

  const bots = useMemo(() => Object.values(attachBots).filter((bot) => (
    bot.isForSideMenu && !(isWalletAvailable && bot.id === walletBotId)
  )), [attachBots, isWalletAvailable, walletBotId]);

  const handleOpenWallet = useLastCallback(() => {
    openWalletModal();
  });

  const handleSelectMyProfile = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId, shouldReplaceHistory: true, isOwnProfile: true });
  });

  const handleSelectSaved = useLastCallback(() => {
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleDarkModeToggle = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const shouldUseSystemTheme = newTheme === getSystemTheme();

    setSharedSettingOption({ theme: newTheme });
    setSharedSettingOption({ shouldUseSystemTheme });
  });

  const handleAnimationLevelChange = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();

    let newLevel = animationLevel + 1;
    if (newLevel > ANIMATION_LEVEL_MAX) {
      newLevel = ANIMATION_LEVEL_MIN;
    }
    const performanceSettings = newLevel === ANIMATION_LEVEL_MIN
      ? INITIAL_PERFORMANCE_STATE_MIN
      : (newLevel === ANIMATION_LEVEL_MAX ? INITIAL_PERFORMANCE_STATE_MAX : INITIAL_PERFORMANCE_STATE_MED);

    setSharedSettingOption({ animationLevel: newLevel as AnimationLevel, wasAnimationLevelSetManually: true });
    updatePerformanceSettings(performanceSettings);
  });

  const handleChangelogClick = useLastCallback(() => {
    window.open(BETA_CHANGELOG_URL, '_blank', 'noopener,noreferrer');
  });

  const handleSwitchToWebK = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.preventDefault();
    if (hasPasscode) {
      openSwitchToWebKDialog();
      return;
    }

    switchPermanentWebVersion('K');
  });

  const handleOpenPasscodeSettings = useLastCallback(() => {
    closeSwitchToWebKDialog();
    openSettingsScreen({ screen: SettingsScreens.PasscodeTurnOff });
  });

  const handleOpenTipsChat = useLastCallback(() => {
    openChatByUsername({ username: lang('TelegramFeaturesUsername') });
  });

  const handleBugReportClick = useLastCallback(() => {
    openUrl({ url: FEEDBACK_URL });
  });

  return (
    <>
      {IS_MULTIACCOUNT_SUPPORTED && currentUser && (
        <>
          <AccountMenuItems
            currentUser={currentUser}
            totalLimit={accountsTotalLimit}
            onSelectCurrent={onSelectSettings}
            onSwitchAccount={onSwitchAccount}
          />
          <MenuSeparator />
        </>
      )}
      <MenuItem
        icon="user"
        onClick={handleSelectMyProfile}
      >
        {lang('MenuMyProfile')}
      </MenuItem>
      <MenuItem
        icon="saved-messages"
        onClick={handleSelectSaved}
      >
        {lang('MenuSavedMessages')}
      </MenuItem>
      {archiveSettings.isHidden && (
        <MenuItem
          icon="archive"
          onClick={onSelectArchived}
        >
          <span className="menu-item-name">{lang('MenuArchivedChats')}</span>
          {archivedUnreadChatsCount > 0 && (
            <div className="right-badge">{archivedUnreadChatsCount}</div>
          )}
        </MenuItem>
      )}
      <MenuItem
        icon="group"
        onClick={onSelectContacts}
      >
        {lang('MenuContacts')}
      </MenuItem>
      {isWalletAvailable && (
        <MenuItem
          icon="gram-outline"
          onClick={handleOpenWallet}
        >
          {lang('WalletMenuItem')}
        </MenuItem>
      )}
      {bots.map((bot) => (
        <AttachBotItem
          bot={bot}
          theme={theme}
          isInSideMenu
          canShowNew
          onMenuOpened={onBotMenuOpened}
          onMenuClosed={onBotMenuClosed}
        />
      ))}
      <MenuItem
        icon="settings"
        onClick={onSelectSettings}
      >
        {lang('MenuSettings')}
      </MenuItem>
      <NestedMenuItem
        icon="more"
        footer={footer}
        submenu={(
          <>
            <MenuItem
              icon="darkmode"
              onClick={handleDarkModeToggle}
            >
              <span className="menu-item-name">{lang('MenuNightMode')}</span>
              <Switcher
                id="darkmode"
                label={lang(theme === 'dark' ? 'AriaMenuDisableNightMode' : 'AriaMenuEnableNightMode')}
                checked={theme === 'dark'}
                noAnimation
              />
            </MenuItem>
            <MenuItem
              icon="animations"
              onClick={handleAnimationLevelChange}
            >
              <span className="menu-item-name capitalize">{lang('MenuUIFeaturesSwitch')}</span>
              <Toggle value={animationLevelValue} />
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon="help"
              onClick={handleOpenTipsChat}
            >
              {lang('MenuTelegramFeatures')}
            </MenuItem>
            <MenuItem
              icon="bug"
              onClick={handleBugReportClick}
            >
              {lang('MenuReportBug')}
            </MenuItem>
            {IS_BETA && (
              <MenuItem
                icon="permissions"
                onClick={handleChangelogClick}
              >
                {lang('MenuBetaChangelog')}
              </MenuItem>
            )}
            {withOtherVersions && (
              <MenuItem
                icon="K"
                isCharIcon
                href={`${WEB_VERSION_BASE}k`}
                onClick={handleSwitchToWebK}
              >
                {lang('MenuSwitchToK')}
              </MenuItem>
            )}
            {canInstall && (
              <MenuItem
                icon="install"
                onClick={getPromptInstall()}
              >
                {lang('MenuInstallApp')}
              </MenuItem>
            )}
          </>
        )}
      >
        {lang('MenuMore')}
      </NestedMenuItem>
      <ConfirmDialog
        isOpen={isSwitchToWebKDialogOpen}
        title={lang('MenuSwitchToK')}
        text={lang('PasscodeSwitchToKInfo')}
        confirmLabel={lang('Continue')}
        confirmHandler={handleOpenPasscodeSettings}
        onClose={closeSwitchToWebKDialog}
      />
    </>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const {
      currentUserId, archiveSettings,
    } = global;
    const { animationLevel } = selectSharedSettings(global);
    const attachBots = global.attachMenu.bots;

    return {
      currentUserId,
      currentUser: selectUser(global, currentUserId!),
      theme: selectTheme(global),
      animationLevel,
      canInstall: Boolean(tabState.canInstall),
      archiveSettings,
      attachBots,
      walletBotId: selectWalletBotId(global),
      accountsTotalLimit: selectPremiumLimit(global, 'moreAccounts'),
      hasPasscode: global.passcode.hasPasscode,
      isWalletAvailable: Boolean(global.appConfig.isWalletAvailable),
    };
  },
)(LeftSideMenuItems));
