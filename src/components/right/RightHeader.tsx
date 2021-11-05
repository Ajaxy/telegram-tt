import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ManagementScreens, ProfileState } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { debounce } from '../../util/schedulers';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';
import {
  selectChat,
  selectCurrentGifSearch,
  selectCurrentStickerSearch,
  selectCurrentTextSearch,
  selectIsChatWithSelf,
  selectUser,
} from '../../modules/selectors';
import {
  getCanAddContact,
  isChatAdmin,
  isChatChannel,
  isUserId,
} from '../../modules/helpers';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import './RightHeader.scss';
import { getDayStartAt } from '../../util/dateFormat';

type OwnProps = {
  chatId?: string;
  isColumnOpen?: boolean;
  isProfile?: boolean;
  isSearch?: boolean;
  isManagement?: boolean;
  isStickerSearch?: boolean;
  isGifSearch?: boolean;
  isPollResults?: boolean;
  isAddingChatMembers?: boolean;
  shouldSkipAnimation?: boolean;
  profileState?: ProfileState;
  managementScreen?: ManagementScreens;
  onClose: () => void;
};

type StateProps = {
  canAddContact?: boolean;
  canManage?: boolean;
  isChannel?: boolean;
  userId?: string;
  messageSearchQuery?: string;
  stickerSearchQuery?: string;
  gifSearchQuery?: string;
};

type DispatchProps = Pick<GlobalActions, (
  'setLocalTextSearchQuery' | 'setStickerSearchQuery' | 'setGifSearchQuery' |
  'searchTextMessagesLocal' | 'toggleManagement' | 'openHistoryCalendar' | 'addContact'
)>;

const COLUMN_CLOSE_DELAY_MS = 300;
const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

enum HeaderContent {
  Profile,
  MemberList,
  SharedMedia,
  Search,
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
  AddingMembers,
}

const RightHeader: FC<OwnProps & StateProps & DispatchProps> = ({
  isColumnOpen,
  isProfile,
  isSearch,
  isManagement,
  isStickerSearch,
  isGifSearch,
  isPollResults,
  isAddingChatMembers,
  profileState,
  managementScreen,
  canAddContact,
  userId,
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
  openHistoryCalendar,
  shouldSkipAnimation,
  addContact,
}) => {
  // eslint-disable-next-line no-null/no-null
  const backButtonRef = useRef<HTMLDivElement>(null);

  const handleMessageSearchQueryChange = useCallback((query: string) => {
    setLocalTextSearchQuery({ query });

    if (query.length) {
      runDebouncedForSearch(searchTextMessagesLocal);
    }
  }, [searchTextMessagesLocal, setLocalTextSearchQuery]);

  const handleStickerSearchQueryChange = useCallback((query: string) => {
    setStickerSearchQuery({ query });
  }, [setStickerSearchQuery]);

  const handleGifSearchQueryChange = useCallback((query: string) => {
    setGifSearchQuery({ query });
  }, [setGifSearchQuery]);

  const handleAddContact = useCallback(() => {
    addContact({ userId });
  }, [addContact, userId]);

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
  ) : isAddingChatMembers ? (
    HeaderContent.AddingMembers
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
    ) : undefined // Never reached
  ) : undefined; // When column is closed

  const renderingContentKey = useCurrentOrPrev(contentKey, true) ?? -1;

  function renderHeaderContent() {
    if (renderingContentKey === -1) {
      return undefined;
    }

    switch (renderingContentKey) {
      case HeaderContent.PollResults:
        return <h3>{lang('PollResults')}</h3>;
      case HeaderContent.Search:
        return (
          <>
            <SearchInput
              parentContainerClassName="RightSearch"
              value={messageSearchQuery}
              onChange={handleMessageSearchQueryChange}
            />
            <Button
              round
              size="smaller"
              color="translucent"
              onClick={() => openHistoryCalendar({ selectedAt: getDayStartAt(Date.now()) })}
              ariaLabel="Search messages by date"
            >
              <i className="icon-calendar" />
            </Button>
          </>
        );
      case HeaderContent.AddingMembers:
        return <h3>{lang('GroupAddMembers')}</h3>;
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
            placeholder={lang('SearchStickersHint')}
            autoFocusSearch
            onChange={handleStickerSearchQueryChange}
          />
        );
      case HeaderContent.GifSearch:
        return (
          <SearchInput
            value={gifSearchQuery}
            placeholder={lang('SearchGifsTitle')}
            autoFocusSearch
            onChange={handleGifSearchQueryChange}
          />
        );
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
            <h3>Profile</h3>
            <section className="tools">
              {canAddContact && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('AddContact')}
                  onClick={handleAddContact}
                >
                  <i className="icon-add-user" />
                </Button>
              )}
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
            </section>
          </>
        );
    }
  }

  const isBackButton = (
    IS_SINGLE_COLUMN_LAYOUT
    || contentKey === HeaderContent.SharedMedia
    || contentKey === HeaderContent.MemberList
    || contentKey === HeaderContent.AddingMembers
    || isManagement
  );

  const buttonClassName = buildClassName(
    'animated-close-icon',
    isBackButton && 'state-back',
    (shouldSkipTransition || shouldSkipAnimation) && 'no-transition',
  );

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
        name={(shouldSkipTransition || shouldSkipAnimation) ? 'none' : 'slide-fade'}
        activeKey={renderingContentKey}
      >
        {renderHeaderContent}
      </Transition>
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
    const user = isProfile && chatId && isUserId(chatId) ? selectUser(global, chatId) : undefined;

    const canAddContact = user && getCanAddContact(user);
    const canManage = Boolean(
      !isManagement
      && isProfile
      && !canAddContact
      && chat
      && !selectIsChatWithSelf(global, chat.id)
      // chat.isCreator is for Basic Groups
      && (isUserId(chat.id) || ((isChatAdmin(chat) || chat.isCreator) && !chat.isNotJoined)),
    );

    return {
      canManage,
      canAddContact,
      isChannel,
      userId: user?.id,
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
    'openHistoryCalendar',
    'addContact',
  ]),
)(RightHeader));
