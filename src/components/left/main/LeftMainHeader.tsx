import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { GlobalState } from '../../../global/types';
import type { ThemeKey } from '../../../types';
import { LeftColumnContent, SettingsScreens } from '../../../types';

import {
  selectCanSetPasscode,
  selectCurrentMessageList,
  selectIsCurrentUserPremium,
  selectIsForumPanelOpen,
  selectTabState,
  selectTheme,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { IS_TAURI } from '../../../util/browser/globalEnvironment';
import { IS_APP, IS_MAC_OS } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { formatDateToString } from '../../../util/dates/dateFormat';

import useAppLayout from '../../../hooks/useAppLayout';
import useConnectionStatus from '../../../hooks/useConnectionStatus';
import { useHotkeys } from '../../../hooks/useHotkeys';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Icon from '../../common/icons/Icon';
import MainMenuDropdown from '../../common/MainMenuDropdown';
import PeerChip from '../../common/PeerChip';
import StoryToggler from '../../story/StoryToggler';
import Button from '../../ui/Button';
import SearchInput from '../../ui/SearchInput';
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
  isFoldersSidebarShown?: boolean;
  onSearchQuery: (query: string) => void;
  onReset: NoneToVoidFunction;
};

type StateProps = {
  searchQuery?: string;
  isLoading: boolean;
  globalSearchChatId?: string;
  searchDate?: number;
  theme: ThemeKey;
  isMessageListOpen: boolean;
  isCurrentUserPremium?: boolean;
  isConnectionStatusMinimized?: boolean;
  areChatsLoaded?: boolean;
  hasPasscode?: boolean;
  canSetPasscode?: boolean;
  isForumPanelOpen?: boolean;
} & Pick<GlobalState, 'connectionState' | 'isSyncing' | 'isFetchingDifference'>;

const CLEAR_DATE_SEARCH_PARAM = { date: undefined };
const CLEAR_CHAT_SEARCH_PARAM = { id: undefined };

const IS_WITH_WINDOW_BUTTONS = IS_TAURI && IS_MAC_OS;

const LeftMainHeader = ({
  shouldHideSearch,
  content,
  contactsFilter,
  isClosingSearch,
  searchQuery,
  isLoading,
  isCurrentUserPremium,
  shouldSkipTransition,
  globalSearchChatId,
  searchDate,
  theme,
  connectionState,
  isSyncing,
  isFetchingDifference,
  isMessageListOpen,
  isConnectionStatusMinimized,
  areChatsLoaded,
  hasPasscode,
  canSetPasscode,
  isFoldersSidebarShown,
  isForumPanelOpen,
  onSearchQuery,
  onReset,
}: OwnProps & StateProps) => {
  const {
    setGlobalSearchDate,
    setSharedSettingOption,
    setGlobalSearchChatId,
    lockScreen,
    openSettingsScreen,
    searchMessagesGlobal,
    closeForumPanel,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();
  const { isMobile } = useAppLayout();

  const areContactsVisible = content === LeftColumnContent.Contacts;
  const hasMenu = content === LeftColumnContent.ChatList;

  const isSearchButton = isForumPanelOpen && isFoldersSidebarShown && !IS_WITH_WINDOW_BUTTONS;

  const selectedSearchDate = useMemo(() => {
    return searchDate
      ? formatDateToString(new Date(searchDate * 1000))
      : undefined;
  }, [searchDate]);

  const { connectionStatus, connectionStatusText, connectionStatusPosition } = useConnectionStatus(
    oldLang,
    connectionState,
    isSyncing || isFetchingDifference,
    isMessageListOpen,
    isConnectionStatusMinimized,
    !areChatsLoaded,
  );

  const handleLockScreenHotkey = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasPasscode) {
      lockScreen();
    } else {
      openSettingsScreen({ screen: SettingsScreens.PasscodeDisabled });
    }
  });

  const handleForumSearchClick = useLastCallback(() => {
    closeForumPanel();
  });

  useHotkeys(useMemo(() => (canSetPasscode ? {
    'Ctrl+Shift+L': handleLockScreenHotkey,
    'Alt+Shift+L': handleLockScreenHotkey,
    'Meta+Shift+L': handleLockScreenHotkey,
    ...(IS_APP && { 'Mod+L': handleLockScreenHotkey }),
  } : undefined), [canSetPasscode]));

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !isMobile}
        size="smaller"
        color="translucent"
        className={buildClassName(isOpen && 'active')}

        onClick={isSearchButton ? handleForumSearchClick : hasMenu ? onTrigger : () => onReset()}
        ariaLabel={hasMenu ? lang('AriaLabelOpenMenu') : lang('AriaLabelBackChatList')}
      >
        {isSearchButton ? (
          <Icon name="search" />
        ) : (
          <div className={buildClassName(
            'animated-menu-icon',
            !hasMenu && 'state-back',
            shouldSkipTransition && 'no-animation',
          )}
          />
        )}
      </Button>
    );
  }, [hasMenu, isSearchButton, isMobile, lang, onReset, shouldSkipTransition]);

  const handleSearchFocus = useLastCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  });

  const toggleConnectionStatus = useLastCallback(() => {
    setSharedSettingOption({ isConnectionStatusMinimized: !isConnectionStatusMinimized });
  });

  const handleLockScreen = useLastCallback(() => {
    lockScreen();
  });

  const handleSearchEnter = useLastCallback(() => {
    if (searchQuery && content === LeftColumnContent.GlobalSearch) {
      searchMessagesGlobal({
        type: 'publicPosts',
        shouldResetResultsByType: true,
      });
    }
  });

  const isSearchRelevant = Boolean(globalSearchChatId)
    || content === LeftColumnContent.GlobalSearch
    || content === LeftColumnContent.Contacts;

  const isSearchFocused = isMobile ? !isMessageListOpen && isSearchRelevant : isSearchRelevant;

  useEffect(() => (isSearchFocused ? captureEscKeyListener(() => onReset()) : undefined), [isSearchFocused, onReset]);

  const searchInputPlaceholder = content === LeftColumnContent.Contacts
    ? lang('SearchFriends')
    : lang('Search');

  const withStoryToggler = !isSearchFocused && !selectedSearchDate && !globalSearchChatId && !areContactsVisible;

  const searchContent = useMemo(() => {
    return (
      <>
        {selectedSearchDate && (
          <PeerChip
            icon="calendar"
            title={selectedSearchDate}
            canClose
            isMinimized={Boolean(globalSearchChatId)}
            className="left-search-picker-item"
            onClick={setGlobalSearchDate}
            isCloseNonDestructive
            clickArg={CLEAR_DATE_SEARCH_PARAM}
          />
        )}
        {globalSearchChatId && (
          <PeerChip
            className="left-search-picker-item"
            peerId={globalSearchChatId}
            onClick={setGlobalSearchChatId}
            canClose
            isMinimized
            clickArg={CLEAR_CHAT_SEARCH_PARAM}
          />
        )}
      </>
    );
  }, [globalSearchChatId, selectedSearchDate]);

  return (
    <div className="LeftMainHeader">
      <div
        id="LeftMainHeader"
        className="left-header"
        data-tauri-drag-region={IS_WITH_WINDOW_BUTTONS ? true : undefined}
      >
        {lang.isRtl && <div className="DropdownMenuFiller" />}
        <MainMenuDropdown
          trigger={MainButton}
          className={buildClassName(
            hasMenu && isFoldersSidebarShown && !IS_WITH_WINDOW_BUTTONS && !isSearchButton && 'hide-menu-button',
            isSearchButton && 'forum-search-button',
          )}
        />
        <SearchInput
          inputId="telegram-search-input"
          resultsItemSelector=".LeftSearch .ListItem-button"
          className={buildClassName(
            (globalSearchChatId || searchDate) ? 'with-picker-item' : undefined,
            shouldHideSearch && 'SearchInput--hidden',
            hasMenu && isFoldersSidebarShown && !IS_WITH_WINDOW_BUTTONS && 'SearchInput--no-left-margin',
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
          onEnter={handleSearchEnter}
        >
          {searchContent}
          <StoryToggler
            canShow={withStoryToggler}
          />
        </SearchInput>
        {isCurrentUserPremium && <StatusButton />}
        {hasPasscode && (
          <Button
            round
            ripple={!isMobile}
            size="smaller"
            color="translucent"
            ariaLabel={`${oldLang('ShortcutsController.Others.LockByPasscode')} (Ctrl+Shift+L)`}
            onClick={handleLockScreen}
            className={buildClassName(!isCurrentUserPremium && 'extra-spacing')}
            iconName="lock"
          />
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
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const {
      query: searchQuery, fetchingStatus, chatId, minDate,
    } = tabState.globalSearch;
    const {
      connectionState, isSyncing, isFetchingDifference,
    } = global;
    const { isConnectionStatusMinimized } = selectSharedSettings(global);
    const isForumPanelOpen = selectIsForumPanelOpen(global);

    return {
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats
        || fetchingStatus.messages || fetchingStatus.publicPosts) : false,
      globalSearchChatId: chatId,
      searchDate: minDate,
      theme: selectTheme(global),
      connectionState,
      isSyncing,
      isFetchingDifference,
      isMessageListOpen: Boolean(selectCurrentMessageList(global)),
      isConnectionStatusMinimized,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      areChatsLoaded: Boolean(global.chats.listIds.active),
      hasPasscode: Boolean(global.passcode.hasPasscode),
      canSetPasscode: selectCanSetPasscode(global),
      isForumPanelOpen,
    };
  },
)(LeftMainHeader));
