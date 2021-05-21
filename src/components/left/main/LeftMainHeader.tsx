import React, {
  FC, useCallback, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { LeftColumnContent, ISettings } from '../../../types';
import { ApiChat } from '../../../api/types';

import {
  APP_INFO, DEFAULT_PATTERN_COLOR, FEEDBACK_URL, DARK_THEME_BG_COLOR, DARK_THEME_PATTERN_COLOR,
} from '../../../config';
import { IS_MOBILE_SCREEN } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import { isChatArchived } from '../../../modules/helpers';
import { formatDateToString } from '../../../util/dateFormat';
import switchTheme from '../../../util/switchTheme';
import useLang from '../../../hooks/useLang';

import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Button from '../../ui/Button';
import SearchInput from '../../ui/SearchInput';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import Switcher from '../../ui/Switcher';

import './LeftMainHeader.scss';

type OwnProps = {
  content: LeftColumnContent;
  contactsFilter: string;
  onSearchQuery: (query: string) => void;
  onSelectSettings: () => void;
  onSelectContacts: () => void;
  onSelectArchived: () => void;
  onReset: () => void;
};

type StateProps = {
  searchQuery?: string;
  isLoading: boolean;
  currentUserId?: number;
  globalSearchChatId?: number;
  searchDate?: number;
  theme: ISettings['theme'];
  animationLevel: 0 | 1 | 2;
  chatsById?: Record<number, ApiChat>;
};

type DispatchProps = Pick<GlobalActions, (
  'openChat' | 'openTipsChat' | 'setGlobalSearchDate' | 'setGlobalSearchChatId' | 'setSettingOption'
)>;

const ANIMATION_LEVEL_OPTIONS = [0, 1, 2];

const LeftMainHeader: FC<OwnProps & StateProps & DispatchProps> = ({
  content,
  contactsFilter,
  onSearchQuery,
  onSelectSettings,
  onSelectContacts,
  onSelectArchived,
  setGlobalSearchChatId,
  onReset,
  searchQuery,
  isLoading,
  currentUserId,
  globalSearchChatId,
  searchDate,
  theme,
  animationLevel,
  chatsById,
  openChat,
  openTipsChat,
  setGlobalSearchDate,
  setSettingOption,
}) => {
  const lang = useLang();
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

  const MainButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={hasMenu && !IS_MOBILE_SCREEN}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={hasMenu ? onTrigger : () => onReset()}
        ariaLabel={hasMenu ? lang('AccDescrOpenMenu2') : 'Return to chat list'}
      >
        <div className={buildClassName('animated-menu-icon', !hasMenu && 'state-back')} />
      </Button>
    );
  }, [hasMenu, lang, onReset]);

  const handleSearchFocus = useCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  }, [searchQuery, onSearchQuery]);

  const handleSelectSaved = useCallback(() => {
    openChat({ id: currentUserId });
  }, [currentUserId, openChat]);

  const handleDarkModeToggle = useCallback((e: React.SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    const isNewThemeDark = newTheme === 'dark';

    setSettingOption({
      theme: newTheme,
      customBackground: isNewThemeDark ? DARK_THEME_BG_COLOR : undefined,
      patternColor: isNewThemeDark ? DARK_THEME_PATTERN_COLOR : DEFAULT_PATTERN_COLOR,
    });
    switchTheme(newTheme, animationLevel > 0);
  }, [animationLevel, setSettingOption, theme]);

  const handleAnimationLevelChange = useCallback((e: React.SyntheticEvent<HTMLDivElement>) => {
    e.stopPropagation();

    const newLevel = animationLevel === 0 ? 2 : 0;
    ANIMATION_LEVEL_OPTIONS.forEach((_, i) => {
      document.body.classList.toggle(`animation-level-${i}`, newLevel === i);
    });

    setSettingOption({ animationLevel: newLevel });
  }, [animationLevel, setSettingOption]);

  const isSearchFocused = (
    Boolean(globalSearchChatId)
    || content === LeftColumnContent.GlobalSearch
    || content === LeftColumnContent.Contacts
  );

  const searchInputPlaceholder = content === LeftColumnContent.Contacts
    ? lang('SearchFriends')
    : lang('Search');

  return (
    <div className="LeftMainHeader">
      <div id="LeftMainHeader" className="left-header">
        <DropdownMenu
          trigger={MainButton}
          footer={APP_INFO}
        >
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
              <div className="archived-badge">{archivedUnreadChatsCount}</div>
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
            onClick={openTipsChat}
          >
            {lang('TelegramFeatures')}
          </MenuItem>
          <MenuItem
            icon="bug"
            href={FEEDBACK_URL}
          >
            Report Bug
          </MenuItem>
        </DropdownMenu>
        <SearchInput
          inputId="telegram-search-input"
          className={globalSearchChatId || searchDate ? 'with-picker-item' : ''}
          value={contactsFilter || searchQuery}
          focused={isSearchFocused}
          isLoading={isLoading}
          placeholder={searchInputPlaceholder}
          canClose={Boolean(globalSearchChatId || searchDate)}
          onChange={onSearchQuery}
          onReset={onReset}
          onFocus={handleSearchFocus}
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
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      query: searchQuery, fetchingStatus, chatId, date,
    } = global.globalSearch;
    const { currentUserId } = global;
    const { byId: chatsById } = global.chats;
    const { theme, animationLevel } = global.settings.byKey;

    return {
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false,
      currentUserId,
      chatsById,
      globalSearchChatId: chatId,
      searchDate: date,
      theme,
      animationLevel,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat',
    'openTipsChat',
    'setGlobalSearchDate',
    'setGlobalSearchChatId',
    'setSettingOption',
  ]),
)(LeftMainHeader));
