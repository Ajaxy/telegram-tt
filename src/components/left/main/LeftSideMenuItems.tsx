import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

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
import { selectTabState, selectTheme } from '../../../global/selectors';
import { getPromptInstall } from '../../../util/installPrompt';
import { switchPermanentWebVersion } from '../../../util/permanentWebVersion';
import { IS_ELECTRON } from '../../../util/windowEnvironment';

import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AttachBotItem from '../../middle/composer/AttachBotItem';
import MenuItem from '../../ui/MenuItem';
import Switcher from '../../ui/Switcher';
import Toggle from '../../ui/Toggle';

type OwnProps = {
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onBotMenuOpened: NoneToVoidFunction;
  onBotMenuClosed: NoneToVoidFunction;
};

type StateProps = {
  animationLevel: AnimationLevel;
  theme: ThemeKey;
  canInstall?: boolean;
  attachBots: GlobalState['attachMenu']['bots'];
} & Pick<GlobalState, 'currentUserId' | 'archiveSettings'>;

const LeftSideMenuItems = ({
  currentUserId,
  archiveSettings,
  animationLevel,
  theme,
  canInstall,
  attachBots,
  onSelectArchived,
  onSelectContacts,
  onSelectSettings,
  onBotMenuOpened,
  onBotMenuClosed,
}: OwnProps & StateProps) => {
  const {
    openChat,
    setSettingOption,
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

  const handleSelectSaved = useLastCallback(() => {
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleDarkModeToggle = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: false });
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

    setSettingOption({ animationLevel: newLevel as AnimationLevel });
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

  const handleOpenMyStories = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId, shouldReplaceHistory: true, profileTab: 'stories' });
  });

  return (
    <>
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
        icon="user"
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
        icon="play-story"
        onClick={handleOpenMyStories}
      >
        {oldLang('Settings.MyStories')}
      </MenuItem>
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
    const { animationLevel } = global.settings.byKey;
    const attachBots = global.attachMenu.bots;

    return {
      currentUserId,
      theme: selectTheme(global),
      animationLevel,
      canInstall: Boolean(tabState.canInstall),
      archiveSettings,
      attachBots,
    };
  },
)(LeftSideMenuItems));
