/* eslint-disable react/jsx-no-bind */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
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
import { IS_ELECTRON, IS_MAC_OS } from '../../../util/windowEnvironment';

import useCommands from '../../../hooks/useCommands';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AttachBotItem from '../../middle/composer/AttachBotItem';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import Toggle from '../../ui/Toggle';

/* import Switcher from '../../ui/Switcher'; */ // for hiding dark mode switcher

type OwnProps = {
  onSelectSettings: NoneToVoidFunction;
  onSelectContacts: NoneToVoidFunction;
  onSelectArchived: NoneToVoidFunction;
  onBotMenuOpened: NoneToVoidFunction;
  onBotMenuClosed: NoneToVoidFunction;
};

export type Workspace = {
  id: string;
  name: string;
  logoUrl?: string;
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
    setSettingOption,
    updatePerformanceSettings,
    openChatByUsername,
    openUrl,
    openChatWithInfo,
  } = getActions();
  const lang = useLang();

  const personalWorkspace : Workspace = {
    id: 'personal',
    name: 'Personal Workspace',
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { // Shortcut: settings
      if (
        ((IS_MAC_OS && e.metaKey) || (!IS_MAC_OS && e.ctrlKey))
        && e.code === 'Comma'
      ) {
        e.preventDefault();
        onSelectSettings();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onSelectSettings]);

  const animationLevelValue = animationLevel !== ANIMATION_LEVEL_MIN
    ? (animationLevel === ANIMATION_LEVEL_MAX ? 'max' : 'mid') : 'min';

  const withOtherVersions = !IS_ELECTRON && (window.location.hostname === PRODUCTION_HOSTNAME || IS_TEST);

  const archivedUnreadChatsCount = useFolderManagerForUnreadCounters()[ARCHIVED_FOLDER_ID]?.chatsCount || 0;

  const bots = useMemo(() => Object.values(attachBots).filter((bot) => bot.isForSideMenu), [attachBots]);
  const savedWorkspacesString = localStorage.getItem('workspaces') || '[]';
  const savedWorkspaces: Workspace[] = JSON.parse(savedWorkspacesString) as Workspace[];
  const allWorkspaces = [personalWorkspace, ...savedWorkspaces];
  const { runCommand } = useCommands();

  const handleOpenWorkspaceSettings = (workspaceId?: string) => {
    runCommand('OPEN_WORKSPACE_SETTINGS', workspaceId);
  };

  const handleOpenAutomationSettings = () => {
    runCommand('OPEN_AUTOMATION_SETTINGS');
  };

  const saveCurrentWorkspaceToLocalStorage = (workspaceId: string) => {
    localStorage.setItem('currentWorkspace', workspaceId);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    saveCurrentWorkspaceToLocalStorage(workspaceId);
  };

  const getCurrentWorkspaceId = (): string | undefined => {
    const workspaceId = localStorage.getItem('currentWorkspace');
    return workspaceId || undefined;
  };

  const currentWorkspaceId = getCurrentWorkspaceId();

  /*
  const handleDarkModeToggle = useLastCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: false });
  });
*/
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | undefined>();

  // Функция для обновления текущего рабочего пространства
  const updateCurrentWorkspace = useCallback(() => {
    const workspaceId = getCurrentWorkspaceId();
    setSelectedWorkspaceId(workspaceId);
  }, []);

  // Использование useEffect для отслеживания изменений
  useEffect(() => {
  // Подписка на событие изменения localStorage
    window.addEventListener('storage', updateCurrentWorkspace);

    // Вызов функции при первом рендеринге компонента
    updateCurrentWorkspace();

    // Отписка от события при размонтировании компонента
    return () => window.removeEventListener('storage', updateCurrentWorkspace);
  }, [updateCurrentWorkspace]);

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
    openChatByUsername({ username: lang('Settings.TipsUsername') });
  });

  const handleBugReportClick = useLastCallback(() => {
    openUrl({ url: FEEDBACK_URL });
  });

  const handleOpenMyStories = useLastCallback(() => {
    openChatWithInfo({ id: currentUserId, shouldReplaceHistory: true, profileTab: 'stories' });
  });

  return (
    <>
      {/*
      {archiveSettings.isHidden && (
        <MenuItem
          icon="archive"
          onClick={onSelectArchived}
        >
          <span className="menu-item-name">{lang('Archive')}</span>
          {archivedUnreadChatsCount > 0 && (
            <div className="right-badge">{archivedUnreadChatsCount}</div>
          )}
        </MenuItem>
      )}
      */}
      {/* <MenuItem
        icon="user"
        onClick={onSelectContacts}
      >
        {lang('Contacts')}
      </MenuItem> */}
      {/*
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
        {lang('Settings.MyStories')}
      </MenuItem>
      */}
      {allWorkspaces.map((workspace) => (
        <MenuItem
          key={workspace.id}
          className="workspace-item"
          onClick={() => handleSelectWorkspace(workspace.id)}
          userProfile={workspace.id === 'personal'}
          isSelected={getCurrentWorkspaceId() === workspace.id} // Обновлено здесь
          customImage={workspace.id !== 'personal' && workspace.logoUrl
            ? (
              <img
                className="ProfilePhoto"
                src={workspace.logoUrl}
                alt={`${workspace.name} logo`}
              />
            ) : undefined}
        >
          {workspace.name}
        </MenuItem>
      ))}
      <MenuItem
        icon="add"
        onClick={() => handleOpenWorkspaceSettings()}
        className="secondary"
      >
        Create workspace
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        onClick={handleOpenAutomationSettings}
      >
        Automations
      </MenuItem>
      <MenuSeparator />
      <MenuItem
        onClick={onSelectSettings}
        shortcut="⌘ ,"
      >
        Personal settings
      </MenuItem>
      {currentWorkspaceId !== 'personal' && (
        <MenuItem
          onClick={() => handleOpenWorkspaceSettings(currentWorkspaceId)}
        >
          Workspace settings
        </MenuItem>
      )}
      {/*
      <MenuItem
        icon="darkmode"
        onClick={handleDarkModeToggle}
      >
        <span className="menu-item-name">{lang('lng_menu_night_mode')}</span>
        <Switcher
          id="darkmode"
          label={lang(theme === 'dark' ? 'lng_settings_disable_night_theme' : 'lng_settings_enable_night_theme')}
          checked={theme === 'dark'}
          noAnimation
        />
      </MenuItem>
      <MenuItem
        icon="animations"
        onClick={handleAnimationLevelChange}
      >
        <span className="menu-item-name capitalize">{lang('Appearance.Animations').toLowerCase()}</span>
        <Toggle value={animationLevelValue} />
      </MenuItem>
      <MenuItem
        icon="help"
        onClick={handleOpenTipsChat}
      >
        {lang('TelegramFeatures')}
      </MenuItem>
      <MenuItem
        icon="bug"
        onClick={handleBugReportClick}
      >
        Report Bug
      </MenuItem>
      {IS_BETA && (
        <MenuItem
          icon="permissions"
          onClick={handleChangelogClick}
        >
          Beta Changelog
        </MenuItem>
      )}
      {withOtherVersions && (
        <MenuItem
          icon="K"
          isCharIcon
          href={`${WEB_VERSION_BASE}k`}
          onClick={handleSwitchToWebK}
        >
          Switch to K Version
        </MenuItem>
      )}
      {canInstall && (
        <MenuItem
          icon="install"
          onClick={getPromptInstall()}
        >
          Install App
        </MenuItem>
      )}
      */}
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
