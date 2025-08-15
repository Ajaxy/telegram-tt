import type React from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { AnimationLevel, ThemeKey } from '../../../types';

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
  INITIAL_PERFORMANCE_STATE_MID,
  INITIAL_PERFORMANCE_STATE_MIN,
} from '../../../global/initialState';
import { selectTabState, selectTheme, selectUser } from '../../../global/selectors';
import { selectPremiumLimit } from '../../../global/selectors/limits';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_MULTIACCOUNT_SUPPORTED } from '../../../util/browser/globalEnvironment';
import { IS_ELECTRON } from '../../../util/browser/windowEnvironment';
import { getPromptInstall } from '../../../util/installPrompt';
import { switchPermanentWebVersion } from '../../../util/permanentWebVersion';

import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AttachBotItem from '../../middle/composer/AttachBotItem';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import Switcher from '../../ui/Switcher';
import Toggle from '../../ui/Toggle';
import AccountMenuItems from './AccountMenuItems';

type OwnProps = {
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onBotMenuOpened: NoneToVoidFunction;
  onBotMenuClosed: NoneToVoidFunction;
};

type StateProps = {
  animationLevel: AnimationLevel;
  currentUser?: ApiUser;
  theme: ThemeKey;
  canInstall?: boolean;
  attachBots: GlobalState['attachMenu']['bots'];
  accountsTotalLimit: number;
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
  onSelectArchived,
  onSelectContacts,
  onSelectSettings,
  onBotMenuOpened,
  onBotMenuClosed,
}: OwnProps & StateProps) => {
  const {
    openChat,
    setSharedSettingOption,
    updatePerformanceSettings,
    openChatByUsername,
    openUrl,
    openChatWithInfo,
  } = getActions();
  const oldLang = useOldLang();
  const lang = useLang();

  const animationLevelValue = animationLevel !== ANIMATION_LEVEL_MIN
    ? (animationLevel === ANIMATION_LEVEL_MAX ? 'max' : 'mid') : 'min';

  const withOtherVersions = !IS_ELECTRON && (window.location.hostname === PRODUCTION_HOSTNAME || IS_TEST);

  const archivedUnreadChatsCount = useFolderManagerForUnreadCounters()[ARCHIVED_FOLDER_ID]?.chatsCount || 0;

  const bots = useMemo(() => Object.values(attachBots).filter((bot) => bot.isForSideMenu), [attachBots]);

  const handleSelectMyProfile = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId, shouldReplaceHistory: true, profileTab: 'stories' });
  });

  const handleSelectSaved = useLastCallback(() => {
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleDarkModeToggle = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';

    setSharedSettingOption({ theme: newTheme });
    setSharedSettingOption({ shouldUseSystemTheme: false });
  });

  const handleAnimationLevelChange = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();

    let newLevel = animationLevel + 1;
    if (newLevel > ANIMATION_LEVEL_MAX) {
      newLevel = ANIMATION_LEVEL_MIN;
    }
    const performanceSettings = newLevel === ANIMATION_LEVEL_MIN
      ? INITIAL_PERFORMANCE_STATE_MIN
      : (newLevel === ANIMATION_LEVEL_MAX ? INITIAL_PERFORMANCE_STATE_MAX : INITIAL_PERFORMANCE_STATE_MID);

    setSharedSettingOption({ animationLevel: newLevel as AnimationLevel });
    updatePerformanceSettings(performanceSettings);
  });

  const handleChangelogClick = useLastCallback(() => {
    window.open(BETA_CHANGELOG_URL, '_blank', 'noopener');
  });

  const handleSwitchToWebK = useLastCallback(() => {
    switchPermanentWebVersion('K');
  });

  const handleOpenTipsChat = useLastCallback(() => {
    openChatByUsername({ username: oldLang('Settings.TipsUsername') });
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
          />
          <MenuSeparator />
        </>
      )}
      <MenuItem
        icon="user"
        onClick={handleSelectMyProfile}
      >
        {oldLang('My Profile')}
      </MenuItem>
      <MenuItem
        icon="saved-messages"
        onClick={handleSelectSaved}
      >
        {oldLang('SavedMessages')}
      </MenuItem>
      {archiveSettings.isHidden && (
        <MenuItem
          icon="archive"
          onClick={onSelectArchived}
        >
          <span className="menu-item-name">{oldLang('ArchivedChats')}</span>
          {archivedUnreadChatsCount > 0 && (
            <div className="right-badge">{archivedUnreadChatsCount}</div>
          )}
        </MenuItem>
      )}
      <MenuItem
        icon="group"
        onClick={onSelectContacts}
      >
        {oldLang('Contacts')}
      </MenuItem>
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
        {oldLang('Settings')}
      </MenuItem>
      <MenuItem
        icon="darkmode"
        onClick={handleDarkModeToggle}
      >
        <span className="menu-item-name">{oldLang('lng_menu_night_mode')}</span>
        <Switcher
          id="darkmode"
          label={oldLang(theme === 'dark' ? 'lng_settings_disable_night_theme' : 'lng_settings_enable_night_theme')}
          checked={theme === 'dark'}
          noAnimation
        />
      </MenuItem>
      <MenuItem
        icon="animations"
        onClick={handleAnimationLevelChange}
      >
        <span className="menu-item-name capitalize">{oldLang('Appearance.Animations').toLowerCase()}</span>
        <Toggle value={animationLevelValue} />
      </MenuItem>
      <MenuItem
        icon="help"
        onClick={handleOpenTipsChat}
      >
        {oldLang('TelegramFeatures')}
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
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
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
      accountsTotalLimit: selectPremiumLimit(global, 'moreAccounts'),
    };
  },
)(LeftSideMenuItems));
