import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GlobalState, TabState } from '../../../global/types';
import type { AnimationLevel, ISettings } from '../../../types';
import { LeftColumnContent, SettingsScreens } from '../../../types';

import {
  ANIMATION_LEVEL_MAX,
  ANIMATION_LEVEL_MIN,
  APP_NAME,
  ARCHIVED_FOLDER_ID,
  BETA_CHANGELOG_URL,
  DEBUG,
  FEEDBACK_URL,
  IS_BETA,
  IS_ELECTRON,
  IS_TEST,
  PRODUCTION_HOSTNAME,
} from '../../../config';
import { IS_APP, IS_MAC_OS } from '../../../util/windowEnvironment';
import {
  INITIAL_PERFORMANCE_STATE_MAX,
  INITIAL_PERFORMANCE_STATE_MID,
  INITIAL_PERFORMANCE_STATE_MIN,
} from '../../../global/initialState';
import buildClassName from '../../../util/buildClassName';
import { formatDateToString } from '../../../util/dateFormat';
import { setPermanentWebVersion } from '../../../util/permanentWebVersion';
import { clearWebsync } from '../../../util/websync';
import {
  selectCanSetPasscode,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectTabState,
  selectTheme,
} from '../../../global/selectors';
import useLang from '../../../hooks/useLang';
import useConnectionStatus from '../../../hooks/useConnectionStatus';
import { useHotkeys } from '../../../hooks/useHotkeys';
import { getPromptInstall } from '../../../util/installPrompt';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import useLastCallback from '../../../hooks/useLastCallback';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';
import { useFullscreenStatus } from '../../../hooks/useFullscreen';
import useElectronDrag from '../../../hooks/useElectronDrag';
import { useFolderManagerForUnreadCounters } from '../../../hooks/useFolderManager';
import useAppLayout from '../../../hooks/useAppLayout';

import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Button from '../../ui/Button';
import SearchInput from '../../ui/SearchInput';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import Switcher from '../../ui/Switcher';
import ShowTransition from '../../ui/ShowTransition';
import ConnectionStatusOverlay from '../ConnectionStatusOverlay';
import StatusButton from './StatusButton';
import Toggle from '../../ui/Toggle';

import './LeftMainHeader.scss';

type OwnProps = {
  shouldHideSearch?: boolean;
  content: LeftColumnContent;
  contactsFilter: string;
  isClosingSearch?: boolean;
  shouldSkipTransition?: boolean;
  onSearchQuery: (query: string) => void;
  onSelectSettings: () => void;
  onSelectContacts: () => void;
  onSelectArchived: () => void;
  onReset: () => void;
};

type StateProps =
  {
    searchQuery?: string;
    isLoading: boolean;
    currentUserId?: string;
    globalSearchChatId?: string;
    searchDate?: number;
    theme: ISettings['theme'];
    animationLevel: AnimationLevel;
    isMessageListOpen: boolean;
    isCurrentUserPremium?: boolean;
    isConnectionStatusMinimized: ISettings['isConnectionStatusMinimized'];
    areChatsLoaded?: boolean;
    hasPasscode?: boolean;
    canSetPasscode?: boolean;
  }
  & Pick<GlobalState, 'connectionState' | 'isSyncing' | 'archiveSettings'>
  & Pick<TabState, 'canInstall'>;

const CLEAR_DATE_SEARCH_PARAM = { date: undefined };
const CLEAR_CHAT_SEARCH_PARAM = { id: undefined };
const WEBK_VERSION_URL = 'https://web.telegram.org/k/';

const LeftMainHeader: FC<OwnProps & StateProps> = ({
  shouldHideSearch,
  content,
  contactsFilter,
  onSearchQuery,
  isClosingSearch,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  onReset,
  searchQuery,
  isLoading,
  isCurrentUserPremium,
  shouldSkipTransition,
  currentUserId,
  globalSearchChatId,
  searchDate,
  theme,
  animationLevel,
  connectionState,
  isSyncing,
  isMessageListOpen,
  isConnectionStatusMinimized,
  areChatsLoaded,
  hasPasscode,
  canSetPasscode,
  canInstall,
  archiveSettings,
}) => {
  const {
    openChat,
    setGlobalSearchDate,
    setSettingOption,
    setGlobalSearchChatId,
    openChatByUsername,
    lockScreen,
    requestNextSettingsScreen,
    skipLockOnUnload,
    openUrl,
    updatePerformanceSettings,
  } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const hasMenu = content === LeftColumnContent.ChatList;
  const selectedSearchDate = useMemo(() => {
    return searchDate
      ? formatDateToString(new Date(searchDate * 1000))
      : undefined;
  }, [searchDate]);

  const archivedUnreadChatsCount = useFolderManagerForUnreadCounters()[ARCHIVED_FOLDER_ID]?.chatsCount || 0;

  const { connectionStatus, connectionStatusText, connectionStatusPosition } = useConnectionStatus(
    lang, connectionState, isSyncing, isMessageListOpen, isConnectionStatusMinimized, !areChatsLoaded,
  );

  const handleLockScreenHotkey = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPasscode) {
      lockScreen();
    } else {
      requestNextSettingsScreen({ screen: SettingsScreens.PasscodeDisabled });
    }
  });

  useHotkeys(canSetPasscode ? {
    'Ctrl+Shift+L': handleLockScreenHotkey,
    'Alt+Shift+L': handleLockScreenHotkey,
    'Meta+Shift+L': handleLockScreenHotkey,
    ...(IS_APP && { 'Mod+L': handleLockScreenHotkey }),
  } : undefined);

  const withOtherVersions = window.location.hostname === PRODUCTION_HOSTNAME || IS_TEST;

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        // eslint-disable-next-line react/jsx-no-bind
        onClick={hasMenu ? onTrigger : () => onReset()}
        ariaLabel={hasMenu ? lang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName(
          'animated-menu-icon',
          !hasMenu && 'state-back',
          shouldSkipTransition && 'no-animation',
        )}
        />
      </Button>
    );
  }, [hasMenu, isMobile, lang, onReset, shouldSkipTransition]);

  const handleSearchFocus = useLastCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  });

  const toggleConnectionStatus = useLastCallback(() => {
    setSettingOption({ isConnectionStatusMinimized: !isConnectionStatusMinimized });
  });

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
    setPermanentWebVersion('K');
    clearWebsync();
    skipLockOnUnload();
  });

  const handleOpenTipsChat = useLastCallback(() => {
    openChatByUsername({ username: lang('Settings.TipsUsername') });
  });

  const handleBugReportClick = useLastCallback(() => {
    openUrl({ url: FEEDBACK_URL });
  });

  const handleLockScreen = useLastCallback(() => {
    lockScreen();
  });

  const isSearchFocused = (
    Boolean(globalSearchChatId)
    || content === LeftColumnContent.GlobalSearch
    || content === LeftColumnContent.Contacts
  );

  useEffect(() => (isSearchFocused ? captureEscKeyListener(() => onReset()) : undefined), [isSearchFocused, onReset]);

  const searchInputPlaceholder = content === LeftColumnContent.Contacts
    ? lang('SearchFriends')
    : lang('Search');

  const versionString = IS_BETA ? `${APP_VERSION} Beta (${APP_REVISION})` : (DEBUG ? APP_REVISION : APP_VERSION);
  const animationLevelValue = animationLevel !== ANIMATION_LEVEL_MIN
    ? (animationLevel === ANIMATION_LEVEL_MAX ? 'max' : 'mid')
    : 'min';

  const isFullscreen = useFullscreenStatus();

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(headerRef);

  const menuItems = useMemo(() => (
    <>
      <MenuItem
        icon="saved-messages"
        onClick={handleSelectSaved}
      >
        {lang('SavedMessages')}
      </MenuItem>
      {archiveSettings.isHidden && (
        <MenuItem
          icon="archive"
          onClick={onSelectArchived}
        >
          <span className="menu-item-name">{lang('ArchivedChats')}</span>
          {archivedUnreadChatsCount > 0 && (
            <div className="right-badge">{archivedUnreadChatsCount}</div>
          )}
        </MenuItem>
      )}
      <MenuItem
        icon="user"
        onClick={onSelectContacts}
      >
        {lang('Contacts')}
      </MenuItem>
      <MenuItem
        icon="settings"
        onClick={onSelectSettings}
      >
        {lang('Settings')}
      </MenuItem>
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
          href={WEBK_VERSION_URL}
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
    </>
  ), [
    animationLevelValue, archivedUnreadChatsCount, canInstall, handleAnimationLevelChange, handleBugReportClick, lang,
    handleChangelogClick, handleDarkModeToggle, handleOpenTipsChat, handleSelectSaved, handleSwitchToWebK,
    onSelectArchived, onSelectContacts, onSelectSettings, theme, withOtherVersions, archiveSettings,
  ]);

  const searchContent = useMemo(() => {
    return (
      <>
        {selectedSearchDate && (
          <PickerSelectedItem
            icon="calendar"
            title={selectedSearchDate}
            canClose
            isMinimized={Boolean(globalSearchChatId)}
            className="search-date"
            onClick={setGlobalSearchDate}
            clickArg={CLEAR_DATE_SEARCH_PARAM}
          />
        )}
        {globalSearchChatId && (
          <PickerSelectedItem
            chatOrUserId={globalSearchChatId}
            onClick={setGlobalSearchChatId}
            canClose
            clickArg={CLEAR_CHAT_SEARCH_PARAM}
          />
        )}
      </>
    );
  }, [globalSearchChatId, selectedSearchDate]);

  return (
    <div className="LeftMainHeader">
      <div id="LeftMainHeader" className="left-header" ref={headerRef}>
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <DropdownMenu
          trigger={MainButton}
          footer={`${APP_NAME} ${versionString}`}
          className={buildClassName(
            'main-menu',
            lang.isRtl && 'rtl',
            shouldHideSearch && lang.isRtl && 'right-aligned',
            shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
          )}
          positionX={shouldHideSearch && lang.isRtl ? 'right' : 'left'}
          transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
          onTransitionEnd={lang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
        >
          {menuItems}
        </DropdownMenu>
        <SearchInput
          inputId="telegram-search-input"
          parentContainerClassName="LeftSearch"
          className={buildClassName(
            (globalSearchChatId || searchDate) ? 'with-picker-item' : undefined,
            shouldHideSearch && 'SearchInput--hidden',
          )}
          value={isClosingSearch ? undefined : (contactsFilter || searchQuery)}
          focused={isSearchFocused}
          isLoading={isLoading || connectionStatusPosition === 'minimized'}
          spinnerColor={connectionStatusPosition === 'minimized' ? 'yellow' : undefined}
          spinnerBackgroundColor={connectionStatusPosition === 'minimized' && theme === 'light' ? 'light' : undefined}
          placeholder={searchInputPlaceholder}
          autoComplete="off"
          canClose={Boolean(globalSearchChatId || searchDate)}
          onChange={onSearchQuery}
          onReset={onReset}
          onFocus={handleSearchFocus}
          onSpinnerClick={connectionStatusPosition === 'minimized' ? toggleConnectionStatus : undefined}
        >
          {searchContent}
        </SearchInput>
        {isCurrentUserPremium && <StatusButton />}
        {hasPasscode && (
          <Button
            round
            ripple={!isMobile}
            size="smaller"
            color="translucent"
            ariaLabel={`${lang('ShortcutsController.Others.LockByPasscode')} (Ctrl+Shift+L)`}
            onClick={handleLockScreen}
            className={buildClassName(!isCurrentUserPremium && 'extra-spacing')}
          >
            <i className="icon icon-lock" />
          </Button>
        )}
        <ShowTransition
          isOpen={connectionStatusPosition === 'overlay'}
          isCustom
          className="connection-state-wrapper"
        >
          <ConnectionStatusOverlay
            connectionStatus={connectionStatus}
            connectionStatusText={connectionStatusText!}
            onClick={toggleConnectionStatus}
          />
        </ShowTransition>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const {
      query: searchQuery, fetchingStatus, chatId, date,
    } = tabState.globalSearch;
    const {
      currentUserId, connectionState, isSyncing, archiveSettings,
    } = global;
    const { isConnectionStatusMinimized, animationLevel } = global.settings.byKey;

    return {
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false,
      currentUserId,
      globalSearchChatId: chatId,
      searchDate: date,
      theme: selectTheme(global),
      animationLevel,
      connectionState,
      isSyncing,
      isMessageListOpen: Boolean(selectCurrentMessageList(global)),
      isConnectionStatusMinimized,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      areChatsLoaded: Boolean(global.chats.listIds.active),
      hasPasscode: Boolean(global.passcode.hasPasscode),
      canInstall: Boolean(tabState.canInstall),
      archiveSettings,
      canSetPasscode: selectCanSetPasscode(global),
    };
  },
)(LeftMainHeader));
