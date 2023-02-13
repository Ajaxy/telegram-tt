import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { AnimationLevel, ISettings } from '../../../types';
import { LeftColumnContent, SettingsScreens } from '../../../types';
import type { ApiChat } from '../../../api/types';
import type { TabState, GlobalState } from '../../../global/types';

import {
  ANIMATION_LEVEL_MAX,
  APP_NAME, APP_VERSION,
  BETA_CHANGELOG_URL,
  DEBUG,
  FEEDBACK_URL,
  IS_BETA,
  IS_TEST,
  PRODUCTION_HOSTNAME,
} from '../../../config';
import { IS_PWA } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import { formatDateToString } from '../../../util/dateFormat';
import switchTheme from '../../../util/switchTheme';
import { setPermanentWebVersion } from '../../../util/permanentWebVersion';
import { clearWebsync } from '../../../util/websync';
import {
  selectCurrentMessageList, selectIsCurrentUserPremium, selectTabState, selectTheme,
} from '../../../global/selectors';
import { isChatArchived } from '../../../global/helpers';
import useLang from '../../../hooks/useLang';
import useConnectionStatus from '../../../hooks/useConnectionStatus';
import { useHotkeys } from '../../../hooks/useHotkeys';
import { getPromptInstall } from '../../../util/installPrompt';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import useLeftHeaderButtonRtlForumTransition from './hooks/useLeftHeaderButtonRtlForumTransition';
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
    chatsById?: Record<string, ApiChat>;
    isMessageListOpen: boolean;
    isCurrentUserPremium?: boolean;
    isConnectionStatusMinimized: ISettings['isConnectionStatusMinimized'];
    areChatsLoaded?: boolean;
    hasPasscode?: boolean;
  }
  & Pick<GlobalState, 'connectionState' | 'isSyncing'> & Pick<TabState, 'canInstall'>;

const ANIMATION_LEVEL_OPTIONS = [0, 1, 2];
const LEGACY_VERSION_URL = 'https://web.telegram.org/?legacy=1';
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
  chatsById,
  connectionState,
  isSyncing,
  isMessageListOpen,
  isConnectionStatusMinimized,
  areChatsLoaded,
  hasPasscode,
  canInstall,
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
  } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const hasMenu = content === LeftColumnContent.ChatList;
  const clearedDateSearchParam = { date: undefined };
  const clearedChatSearchParam = { id: undefined };
  const selectedSearchDate = useMemo(() => {
    return searchDate
      ? formatDateToString(new Date(searchDate * 1000))
      : undefined;
  }, [searchDate]);
  const archivedUnreadChatsCount = useMemo(() => {
    if (!hasMenu || !chatsById) {
      return 0;
    }

    return Object.values(chatsById).reduce((total, chat) => {
      if (!isChatArchived(chat)) {
        return total;
      }

      return chat.unreadCount ? total + 1 : total;
    }, 0);
  }, [hasMenu, chatsById]);

  const { connectionStatus, connectionStatusText, connectionStatusPosition } = useConnectionStatus(
    lang, connectionState, isSyncing, isMessageListOpen, isConnectionStatusMinimized, !areChatsLoaded,
  );

  const handleLockScreenHotkey = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPasscode) {
      lockScreen();
    } else {
      requestNextSettingsScreen({ screen: SettingsScreens.PasscodeDisabled });
    }
  }, [hasPasscode, lockScreen, requestNextSettingsScreen]);

  useHotkeys({
    'Ctrl+Shift+L': handleLockScreenHotkey,
    'Alt+Shift+L': handleLockScreenHotkey,
    'Meta+Shift+L': handleLockScreenHotkey,
    ...(IS_PWA && { 'Mod+L': handleLockScreenHotkey }),
  });

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

  const handleSearchFocus = useCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  }, [searchQuery, onSearchQuery]);

  const toggleConnectionStatus = useCallback(() => {
    setSettingOption({ isConnectionStatusMinimized: !isConnectionStatusMinimized });
  }, [isConnectionStatusMinimized, setSettingOption]);

  const handleSelectSaved = useCallback(() => {
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  }, [currentUserId, openChat]);

  const handleDarkModeToggle = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';

    setSettingOption({ theme: newTheme });
    setSettingOption({ shouldUseSystemTheme: false });
    switchTheme(newTheme, animationLevel === ANIMATION_LEVEL_MAX);
  }, [animationLevel, setSettingOption, theme]);

  const handleAnimationLevelChange = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();

    const newLevel = animationLevel === 0 ? 2 : 0;
    ANIMATION_LEVEL_OPTIONS.forEach((_, i) => {
      document.body.classList.toggle(`animation-level-${i}`, newLevel === i);
    });

    setSettingOption({ animationLevel: newLevel });
  }, [animationLevel, setSettingOption]);

  const handleChangelogClick = useCallback(() => {
    window.open(BETA_CHANGELOG_URL, '_blank', 'noopener');
  }, []);

  const handleSwitchToWebK = useCallback(() => {
    setPermanentWebVersion('K');
    clearWebsync();
    skipLockOnUnload();
  }, [skipLockOnUnload]);

  const handleSwitchToLegacy = useCallback(() => {
    skipLockOnUnload();
  }, [skipLockOnUnload]);

  const handleOpenTipsChat = useCallback(() => {
    openChatByUsername({ username: lang('Settings.TipsUsername') });
  }, [lang, openChatByUsername]);

  const handleBugReportClick = useCallback(() => {
    openUrl({ url: FEEDBACK_URL });
  }, [openUrl]);

  const handleLockScreen = useCallback(() => {
    lockScreen();
  }, [lockScreen]);

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

  // Disable dropdown menu RTL animation for resize
  const {
    shouldDisableDropdownMenuTransitionRef,
    handleDropdownMenuTransitionEnd,
  } = useLeftHeaderButtonRtlForumTransition(shouldHideSearch);

  const menuItems = useMemo(() => (
    <>
      <MenuItem
        icon="saved-messages"
        onClick={handleSelectSaved}
      >
        {lang('SavedMessages')}
      </MenuItem>
      <MenuItem
        icon="archive"
        onClick={onSelectArchived}
      >
        <span className="menu-item-name">{lang('ArchivedChats')}</span>
        {archivedUnreadChatsCount > 0 && (
          <div className="right-badge">{archivedUnreadChatsCount}</div>
        )}
      </MenuItem>
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
        <Switcher
          id="animations"
          label="Toggle Animations"
          checked={animationLevel > 0}
        />
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
        <>
          <MenuItem
            icon="char-K"
            href={WEBK_VERSION_URL}
            onClick={handleSwitchToWebK}
          >
            Switch to K Version
          </MenuItem>
          <MenuItem
            icon="char-W"
            href={LEGACY_VERSION_URL}
            onClick={handleSwitchToLegacy}
          >
            Switch to Old Version
          </MenuItem>
        </>
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
    animationLevel, archivedUnreadChatsCount, canInstall, handleAnimationLevelChange, handleBugReportClick,
    handleChangelogClick, handleDarkModeToggle, handleOpenTipsChat, handleSelectSaved, handleSwitchToLegacy,
    handleSwitchToWebK, lang, onSelectArchived, onSelectContacts, onSelectSettings, theme, withOtherVersions,
  ]);

  return (
    <div className="LeftMainHeader">
      <div id="LeftMainHeader" className="left-header">
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <DropdownMenu
          trigger={MainButton}
          footer={`${APP_NAME} ${versionString}`}
          className={buildClassName(
            lang.isRtl && 'rtl',
            shouldHideSearch && lang.isRtl && 'right-aligned',
            shouldDisableDropdownMenuTransitionRef.current && lang.isRtl && 'disable-transition',
          )}
          positionX={shouldHideSearch && lang.isRtl ? 'right' : 'left'}
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
          {selectedSearchDate && (
            <PickerSelectedItem
              icon="calendar"
              title={selectedSearchDate}
              canClose
              isMinimized={Boolean(globalSearchChatId)}
              className="search-date"
              onClick={setGlobalSearchDate}
              clickArg={clearedDateSearchParam}
            />
          )}
          {globalSearchChatId && (
            <PickerSelectedItem
              chatOrUserId={globalSearchChatId}
              onClick={setGlobalSearchChatId}
              canClose
              clickArg={clearedChatSearchParam}
            />
          )}
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
            <i className="icon-lock" />
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
    const { currentUserId, connectionState, isSyncing } = global;
    const { byId: chatsById } = global.chats;
    const { isConnectionStatusMinimized, animationLevel } = global.settings.byKey;

    return {
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false,
      currentUserId,
      chatsById,
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
    };
  },
)(LeftMainHeader));
