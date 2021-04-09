import React, {
  FC, useCallback, useMemo, memo,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { LeftColumnContent } from '../../../types';
import { ApiChat } from '../../../api/types';

import { IS_MOBILE_SCREEN } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import { pick } from '../../../util/iteratees';
import { isChatArchived } from '../../../modules/helpers';
import { formatDateToString } from '../../../util/dateFormat';
import useLang from '../../../hooks/useLang';

import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Button from '../../ui/Button';
import SearchInput from '../../ui/SearchInput';
import PickerSelectedItem from '../../common/PickerSelectedItem';

import './LeftMainHeader.scss';

type OwnProps = {
  content: LeftColumnContent;
  contactsFilter: string;
  onSearchQuery: (query: string) => void;
  onSelectSettings: () => void;
  onSelectContacts: () => void;
  onSelectNewGroup: () => void;
  onSelectArchived: () => void;
  onReset: () => void;
};

type StateProps = {
  searchQuery?: string;
  isLoading: boolean;
  currentUserId?: number;
  globalSearchChatId?: number;
  searchDate?: number;
  chatsById?: Record<number, ApiChat>;
};

type DispatchProps = Pick<GlobalActions,
'openChat'| 'openSupportChat' | 'setGlobalSearchDate' | 'setGlobalSearchChatId'>;

const LeftMainHeader: FC<OwnProps & StateProps & DispatchProps> = ({
  content,
  contactsFilter,
  onSearchQuery,
  onSelectSettings,
  onSelectContacts,
  onSelectNewGroup,
  onSelectArchived,
  setGlobalSearchChatId,
  onReset,
  searchQuery,
  isLoading,
  currentUserId,
  globalSearchChatId,
  searchDate,
  chatsById,
  openChat,
  openSupportChat,
  setGlobalSearchDate,
}) => {
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
        ariaLabel={hasMenu ? 'Open menu' : 'Return to chat list'}
      >
        <div className={buildClassName('animated-menu-icon', !hasMenu && 'state-back')} />
      </Button>
    );
  }, [hasMenu, onReset]);

  const handleSearchFocus = useCallback(() => {
    if (!searchQuery) {
      onSearchQuery('');
    }
  }, [searchQuery, onSearchQuery]);

  const handleSelectSaved = useCallback(() => {
    openChat({ id: currentUserId });
  }, [currentUserId, openChat]);

  const lang = useLang();

  const isSearchFocused = Boolean(globalSearchChatId)
  || content === LeftColumnContent.GlobalSearch
  || content === LeftColumnContent.Contacts;

  const searchInputPlaceholder = content === LeftColumnContent.Contacts
    ? lang('SearchFriends')
    : lang('Search');

  return (
    <div className="LeftMainHeader">
      <div id="LeftMainHeader" className="left-header">
        <DropdownMenu
          trigger={MainButton}
        >
          <MenuItem
            icon="group"
            onClick={onSelectNewGroup}
          >
            {lang('NewGroup')}
          </MenuItem>
          <MenuItem
            icon="user"
            onClick={onSelectContacts}
          >
            {lang('Contacts')}
          </MenuItem>
          <MenuItem
            icon="archive"
            onClick={onSelectArchived}
          >
            {lang('Archived')}
            {archivedUnreadChatsCount > 0 && (
              <div className="archived-badge">{archivedUnreadChatsCount}</div>
            )}
          </MenuItem>
          <MenuItem
            icon="saved-messages"
            onClick={handleSelectSaved}
          >
            {lang('Saved')}
          </MenuItem>
          <MenuItem
            icon="settings"
            onClick={onSelectSettings}
          >
            {lang('Settings')}
          </MenuItem>
          <MenuItem
            icon="help"
            onClick={openSupportChat}
          >
            {lang('BotHelp')}
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

    return {
      searchQuery,
      isLoading: fetchingStatus ? Boolean(fetchingStatus.chats || fetchingStatus.messages) : false,
      currentUserId,
      chatsById,
      globalSearchChatId: chatId,
      searchDate: date,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openChat',
    'openSupportChat',
    'setGlobalSearchDate',
    'setGlobalSearchChatId',
  ]),
)(LeftMainHeader));
