import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ManagementScreens, ProfileState } from '../../types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import { debounce } from '../../util/schedulers';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';
import {
  selectChat,
  selectCurrentGifSearch,
  selectCurrentStickerSearch,
  selectCurrentTextSearch,
  selectIsChatWithSelf,
} from '../../modules/selectors';
import { isChatAdmin, isChatChannel, isChatPrivate } from '../../modules/helpers';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import CalendarModal from '../common/CalendarModal.async';
import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import './RightHeader.scss';

type OwnProps = {
  chatId?: number;
  isColumnOpen?: boolean;
  isProfile?: boolean;
  isSearch?: boolean;
  isManagement?: boolean;
  isStatistics?: boolean;
  isStickerSearch?: boolean;
  isGifSearch?: boolean;
  isPollResults?: boolean;
  profileState?: ProfileState;
  managementScreen?: ManagementScreens;
  onClose: () => void;
};

type StateProps = {
  canManage?: boolean;
  isChannel?: boolean;
  messageSearchQuery?: string;
  stickerSearchQuery?: string;
  gifSearchQuery?: string;
};

type DispatchProps = Pick<GlobalActions, (
  'setLocalTextSearchQuery' | 'setStickerSearchQuery' | 'setGifSearchQuery' |
  'searchTextMessagesLocal' | 'toggleManagement' | 'toggleStatistics' | 'searchMessagesByDate'
)>;

const COLUMN_CLOSE_DELAY_MS = 300;
const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

enum HeaderContent {
  Profile,
  MemberList,
  SharedMedia,
  Search,
  Statistics,
  Management,
  ManageInitial,
  ManageChannelSubscribers,
  ManageChatAdministrators,
  ManageChatPrivacyType,
  ManageDiscussion,
  ManageGroupPermissions,
  ManageGroupRemovedUsers,
  ManageGroupUserPermissionsCreate,
  ManageGroupUserPermissions,
  ManageGroupRecentActions,
  ManageGroupAdminRights,
  ManageGroupMembers,
  StickerSearch,
  GifSearch,
  PollResults,
}

const RightHeader: FC<OwnProps & StateProps & DispatchProps> = ({
  isColumnOpen,
  isProfile,
  isSearch,
  isManagement,
  isStatistics,
  isStickerSearch,
  isGifSearch,
  isPollResults,
  profileState,
  managementScreen,
  canManage,
  isChannel,
  onClose,
  messageSearchQuery,
  stickerSearchQuery,
  gifSearchQuery,
  setLocalTextSearchQuery,
  setStickerSearchQuery,
  setGifSearchQuery,
  searchTextMessagesLocal,
  toggleManagement,
  toggleStatistics,
  searchMessagesByDate,
}) => {
  // eslint-disable-next-line no-null/no-null
  const backButtonRef = useRef<HTMLDivElement>(null);

  const [isCalendarOpen, openCalendar, closeCalendar] = useFlag();

  const handleMessageSearchQueryChange = useCallback((query: string) => {
    setLocalTextSearchQuery({ query });

    if (query.length) {
      runDebouncedForSearch(searchTextMessagesLocal);
    }
  }, [searchTextMessagesLocal, setLocalTextSearchQuery]);

  const handleJumpToDate = useCallback((date: Date) => {
    searchMessagesByDate({ timestamp: date.valueOf() / 1000 });
    closeCalendar();
  }, [closeCalendar, searchMessagesByDate]);

  const handleStickerSearchQueryChange = useCallback((query: string) => {
    setStickerSearchQuery({ query });
  }, [setStickerSearchQuery]);

  const handleGifSearchQueryChange = useCallback((query: string) => {
    setGifSearchQuery({ query });
  }, [setGifSearchQuery]);

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isColumnOpen);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isColumnOpen);
    }, COLUMN_CLOSE_DELAY_MS);
  }, [isColumnOpen]);

  const lang = useLang();
  const contentKey = isProfile ? (
    profileState === ProfileState.Profile ? (
      HeaderContent.Profile
    ) : profileState === ProfileState.SharedMedia ? (
      HeaderContent.SharedMedia
    ) : profileState === ProfileState.MemberList ? (
      HeaderContent.MemberList
    ) : -1 // Never reached
  ) : isSearch ? (
    HeaderContent.Search
  ) : isPollResults ? (
    HeaderContent.PollResults
  ) : isStickerSearch ? (
    HeaderContent.StickerSearch
  ) : isGifSearch ? (
    HeaderContent.GifSearch
  ) : isManagement ? (
    managementScreen === ManagementScreens.Initial ? (
      HeaderContent.ManageInitial
    ) : managementScreen === ManagementScreens.ChatPrivacyType ? (
      HeaderContent.ManageChatPrivacyType
    ) : managementScreen === ManagementScreens.Discussion ? (
      HeaderContent.ManageDiscussion
    ) : managementScreen === ManagementScreens.ChannelSubscribers ? (
      HeaderContent.ManageChannelSubscribers
    ) : managementScreen === ManagementScreens.GroupPermissions ? (
      HeaderContent.ManageGroupPermissions
    ) : managementScreen === ManagementScreens.ChatAdministrators ? (
      HeaderContent.ManageChatAdministrators
    ) : managementScreen === ManagementScreens.GroupRemovedUsers ? (
      HeaderContent.ManageGroupRemovedUsers
    ) : managementScreen === ManagementScreens.GroupUserPermissionsCreate ? (
      HeaderContent.ManageGroupUserPermissionsCreate
    ) : managementScreen === ManagementScreens.GroupUserPermissions ? (
      HeaderContent.ManageGroupUserPermissions
    ) : managementScreen === ManagementScreens.GroupRecentActions ? (
      HeaderContent.ManageGroupRecentActions
    ) : managementScreen === ManagementScreens.ChatAdminRights ? (
      HeaderContent.ManageGroupAdminRights
    ) : managementScreen === ManagementScreens.GroupMembers ? (
      HeaderContent.ManageGroupMembers
    ) : -1 // Never reached
  ) : isStatistics ? (
    HeaderContent.Statistics
  ) : -1; // Never reached

  const MenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!IS_MOBILE_SCREEN}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : undefined}
        onClick={onTrigger}
        ariaLabel={lang('Common.More')}
      >
        <i className="icon-more" />
      </Button>
    );
  }, [lang]);

  function renderHeaderContent() {
    switch (contentKey) {
      case HeaderContent.PollResults:
        return <h3>{lang('PollResults')}</h3>;
      case HeaderContent.Search:
        return (
          <>
            <SearchInput
              value={messageSearchQuery}
              onChange={handleMessageSearchQueryChange}
            />
            <Button
              round
              size="smaller"
              color="translucent"
              onClick={openCalendar}
              ariaLabel="Search messages by date"
            >
              <i className="icon-calendar" />
            </Button>
          </>
        );
      case HeaderContent.ManageInitial:
        return <h3>{lang('Edit')}</h3>;
      case HeaderContent.ManageChatPrivacyType:
        return <h3>{lang(isChannel ? 'ChannelTypeHeader' : 'GroupTypeHeader')}</h3>;
      case HeaderContent.ManageDiscussion:
        return <h3>{lang('Discussion')}</h3>;
      case HeaderContent.ManageChatAdministrators:
        return <h3>{lang('ChannelAdministrators')}</h3>;
      case HeaderContent.ManageGroupRecentActions:
        return <h3>{lang('Group.Info.AdminLog')}</h3>;
      case HeaderContent.ManageGroupAdminRights:
        return <h3>{lang('EditAdminRights')}</h3>;
      case HeaderContent.ManageGroupPermissions:
        return <h3>{lang('ChannelPermissions')}</h3>;
      case HeaderContent.ManageGroupRemovedUsers:
        return <h3>{lang('ChannelBlockedUsers')}</h3>;
      case HeaderContent.ManageGroupUserPermissionsCreate:
        return <h3>{lang('ChannelAddException')}</h3>;
      case HeaderContent.ManageGroupUserPermissions:
        return <h3>{lang('UserRestrictions')}</h3>;
      case HeaderContent.StickerSearch:
        return (
          <SearchInput
            value={stickerSearchQuery}
            placeholder="Search Stickers"
            onChange={handleStickerSearchQueryChange}
          />
        );
      case HeaderContent.GifSearch:
        return (
          <SearchInput
            value={gifSearchQuery}
            placeholder={lang('SearchGifsTitle')}
            onChange={handleGifSearchQueryChange}
          />
        );
      case HeaderContent.Statistics:
        return <h3>{lang('Statistics')}</h3>;
      case HeaderContent.SharedMedia:
        return <h3>{lang('SharedMedia')}</h3>;
      case HeaderContent.ManageChannelSubscribers:
        return <h3>{lang('ChannelSubscribers')}</h3>;
      case HeaderContent.MemberList:
      case HeaderContent.ManageGroupMembers:
        return <h3>{lang('GroupMembers')}</h3>;
      default:
        return (
          <>
            <h3>{lang('Info')}</h3>
            <section className="tools">
              {canManage && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('Edit')}
                  onClick={toggleManagement}
                >
                  <i className="icon-edit" />
                </Button>
              )}
              <DropdownMenu
                trigger={MenuButton}
                positionX="right"
              >
                <MenuItem icon="poll" onClick={toggleStatistics}>{lang('Statistics')}</MenuItem>
              </DropdownMenu>
            </section>
          </>
        );
    }
  }

  const isBackButton = (
    IS_MOBILE_SCREEN
    || contentKey === HeaderContent.SharedMedia
    || contentKey === HeaderContent.MemberList
    || isManagement
  );

  const buttonClassName = buildClassName(
    'animated-close-icon',
    shouldSkipTransition && 'no-transition',
  );

  // Add class in the next AF to synchronize with animation with Transition components
  useEffect(() => {
    backButtonRef.current!.classList.toggle('state-back', isBackButton);
  }, [isBackButton]);

  return (
    <div className="RightHeader">
      <Button
        className="close-button"
        round
        color="translucent"
        size="smaller"
        onClick={onClose}
        ariaLabel={isBackButton ? lang('Common.Back') : lang('Common.Close')}
      >
        <div ref={backButtonRef} className={buttonClassName} />
      </Button>
      <Transition
        name={shouldSkipTransition ? 'none' : 'slide-fade'}
        activeKey={contentKey}
      >
        {renderHeaderContent}
      </Transition>
      {!IS_MOBILE_SCREEN && (
        <CalendarModal
          isOpen={isCalendarOpen}
          isPastMode
          submitButtonLabel={lang('JumpToDate')}
          onClose={closeCalendar}
          onSubmit={handleJumpToDate}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, isProfile, isManagement }): StateProps => {
    const { query: messageSearchQuery } = selectCurrentTextSearch(global) || {};
    const { query: stickerSearchQuery } = selectCurrentStickerSearch(global) || {};
    const { query: gifSearchQuery } = selectCurrentGifSearch(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const isChannel = chat && isChatChannel(chat);

    const canManage = Boolean(
      !isManagement
      && isProfile
      && chat
      && !selectIsChatWithSelf(global, chat.id)
      // chat.isCreator is for Basic Groups
      && (isChatPrivate(chat.id) || ((isChatAdmin(chat) || chat.isCreator) && !chat.isNotJoined)),
    );

    return {
      canManage,
      isChannel,
      messageSearchQuery,
      stickerSearchQuery,
      gifSearchQuery,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setLocalTextSearchQuery',
    'setStickerSearchQuery',
    'setGifSearchQuery',
    'searchTextMessagesLocal',
    'toggleManagement',
    'toggleStatistics',
    'searchMessagesByDate',
  ]),
)(RightHeader));
