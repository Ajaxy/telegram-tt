import React, {
  FC, memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ManagementScreens, ProfileState } from '../../types';
import { ApiExportedInvite } from '../../api/types';

import { ANIMATION_END_DELAY } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { debounce } from '../../util/schedulers';
import buildClassName from '../../util/buildClassName';
import {
  selectChat,
  selectCurrentGifSearch,
  selectCurrentStickerSearch,
  selectCurrentTextSearch,
  selectIsChatWithSelf,
  selectUser,
} from '../../global/selectors';
import {
  getCanAddContact, isChatAdmin, isChatChannel, isUserId,
} from '../../global/helpers';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import { getDayStartAt } from '../../util/dateFormat';

import SearchInput from '../ui/SearchInput';
import Button from '../ui/Button';
import Transition from '../ui/Transition';
import ConfirmDialog from '../ui/ConfirmDialog';

import './RightHeader.scss';

type OwnProps = {
  chatId?: string;
  isColumnOpen?: boolean;
  isProfile?: boolean;
  isSearch?: boolean;
  isManagement?: boolean;
  isStatistics?: boolean;
  isStickerSearch?: boolean;
  isGifSearch?: boolean;
  isPollResults?: boolean;
  isAddingChatMembers?: boolean;
  profileState?: ProfileState;
  managementScreen?: ManagementScreens;
  onClose: () => void;
  onScreenSelect: (screen: ManagementScreens) => void;
};

type StateProps = {
  canAddContact?: boolean;
  canManage?: boolean;
  canViewStatistics?: boolean;
  isChannel?: boolean;
  userId?: string;
  messageSearchQuery?: string;
  stickerSearchQuery?: string;
  gifSearchQuery?: string;
  isEditingInvite?: boolean;
  currentInviteInfo?: ApiExportedInvite;
  shouldSkipHistoryAnimations?: boolean;
};

const COLUMN_ANIMATION_DURATION = 450 + ANIMATION_END_DELAY;
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
  ManageChannelRemovedUsers,
  ManageGroupUserPermissionsCreate,
  ManageGroupUserPermissions,
  ManageGroupRecentActions,
  ManageGroupAdminRights,
  ManageGroupNewAdminRights,
  ManageGroupMembers,
  ManageGroupAddAdmins,
  StickerSearch,
  GifSearch,
  PollResults,
  AddingMembers,
  ManageInvites,
  ManageEditInvite,
  ManageReactions,
  ManageInviteInfo,
  ManageJoinRequests,
}

const RightHeader: FC<OwnProps & StateProps> = ({
  chatId,
  isColumnOpen,
  isProfile,
  isSearch,
  isManagement,
  isStatistics,
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
  onScreenSelect,
  messageSearchQuery,
  stickerSearchQuery,
  gifSearchQuery,
  isEditingInvite,
  canViewStatistics,
  currentInviteInfo,
  shouldSkipHistoryAnimations,
}) => {
  const {
    setLocalTextSearchQuery,
    setStickerSearchQuery,
    setGifSearchQuery,
    searchTextMessagesLocal,
    toggleManagement,
    openHistoryCalendar,
    openAddContactDialog,
    toggleStatistics,
    setEditingExportedInvite,
    deleteExportedChatInvite,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const backButtonRef = useRef<HTMLDivElement>(null);
  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();

  const handleEditInviteClick = useCallback(() => {
    setEditingExportedInvite({ chatId: chatId!, invite: currentInviteInfo! });
    onScreenSelect(ManagementScreens.EditInvite);
  }, [chatId, currentInviteInfo, onScreenSelect, setEditingExportedInvite]);

  const handleDeleteInviteClick = useCallback(() => {
    deleteExportedChatInvite({ chatId: chatId!, link: currentInviteInfo!.link });
    onScreenSelect(ManagementScreens.Invites);
    closeDeleteDialog();
  }, [chatId, closeDeleteDialog, currentInviteInfo, deleteExportedChatInvite, onScreenSelect]);

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
    openAddContactDialog({ userId });
  }, [openAddContactDialog, userId]);

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isColumnOpen);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isColumnOpen);
    }, COLUMN_ANIMATION_DURATION);
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
    ) : managementScreen === ManagementScreens.ChannelRemovedUsers ? (
      HeaderContent.ManageChannelRemovedUsers
    ) : managementScreen === ManagementScreens.GroupUserPermissionsCreate ? (
      HeaderContent.ManageGroupUserPermissionsCreate
    ) : managementScreen === ManagementScreens.GroupUserPermissions ? (
      HeaderContent.ManageGroupUserPermissions
    ) : managementScreen === ManagementScreens.GroupRecentActions ? (
      HeaderContent.ManageGroupRecentActions
    ) : managementScreen === ManagementScreens.ChatAdminRights ? (
      HeaderContent.ManageGroupAdminRights
    ) : managementScreen === ManagementScreens.ChatNewAdminRights ? (
      HeaderContent.ManageGroupNewAdminRights
    ) : managementScreen === ManagementScreens.GroupMembers ? (
      HeaderContent.ManageGroupMembers
    ) : managementScreen === ManagementScreens.Invites ? (
      HeaderContent.ManageInvites
    ) : managementScreen === ManagementScreens.EditInvite ? (
      HeaderContent.ManageEditInvite
    ) : managementScreen === ManagementScreens.GroupAddAdmins ? (
      HeaderContent.ManageGroupAddAdmins
    ) : managementScreen === ManagementScreens.Reactions ? (
      HeaderContent.ManageReactions
    ) : managementScreen === ManagementScreens.InviteInfo ? (
      HeaderContent.ManageInviteInfo
    ) : managementScreen === ManagementScreens.JoinRequests ? (
      HeaderContent.ManageJoinRequests
    ) : undefined // Never reached
  ) : isStatistics ? (
    HeaderContent.Statistics
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
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => openHistoryCalendar({ selectedAt: getDayStartAt(Date.now()) })}
              ariaLabel="Search messages by date"
            >
              <i className="icon-calendar" />
            </Button>
          </>
        );
      case HeaderContent.AddingMembers:
        return <h3>{lang(isChannel ? 'ChannelAddSubscribers' : 'GroupAddMembers')}</h3>;
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
      case HeaderContent.ManageGroupNewAdminRights:
        return <h3>{lang('SetAsAdmin')}</h3>;
      case HeaderContent.ManageGroupPermissions:
        return <h3>{lang('ChannelPermissions')}</h3>;
      case HeaderContent.ManageGroupRemovedUsers:
        return <h3>{lang('BlockedUsers')}</h3>;
      case HeaderContent.ManageChannelRemovedUsers:
        return <h3>{lang('ChannelBlockedUsers')}</h3>;
      case HeaderContent.ManageGroupUserPermissionsCreate:
        return <h3>{lang('ChannelAddException')}</h3>;
      case HeaderContent.ManageGroupUserPermissions:
        return <h3>{lang('UserRestrictions')}</h3>;
      case HeaderContent.ManageInvites:
        return <h3>{lang('lng_group_invite_title')}</h3>;
      case HeaderContent.ManageEditInvite:
        return <h3>{isEditingInvite ? lang('EditLink') : lang('NewLink')}</h3>;
      case HeaderContent.ManageInviteInfo:
        return (
          <>
            <h3>{lang('InviteLink')}</h3>
            <section className="tools">
              {currentInviteInfo && !currentInviteInfo.isRevoked && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('Edit')}
                  onClick={handleEditInviteClick}
                >
                  <i className="icon-edit" />
                </Button>
              )}
              {currentInviteInfo && currentInviteInfo.isRevoked && (
                <>
                  <Button
                    round
                    color="danger"
                    size="smaller"
                    ariaLabel={lang('Delete')}
                    onClick={openDeleteDialog}
                  >
                    <i className="icon-delete" />
                  </Button>
                  <ConfirmDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={closeDeleteDialog}
                    title={lang('DeleteLink')}
                    text={lang('DeleteLinkHelp')}
                    confirmIsDestructive
                    confirmLabel={lang('Delete')}
                    confirmHandler={handleDeleteInviteClick}
                  />
                </>
              )}
            </section>
          </>
        );
      case HeaderContent.ManageJoinRequests:
        return <h3>{isChannel ? lang('SubscribeRequests') : lang('MemberRequests')}</h3>;
      case HeaderContent.ManageGroupAddAdmins:
        return <h3>{lang('Channel.Management.AddModerator')}</h3>;
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
      case HeaderContent.Statistics:
        return <h3>{lang(isChannel ? 'ChannelStats.Title' : 'GroupStats.Title')}</h3>;
      case HeaderContent.SharedMedia:
        return <h3>{lang('SharedMedia')}</h3>;
      case HeaderContent.ManageChannelSubscribers:
        return <h3>{lang('ChannelSubscribers')}</h3>;
      case HeaderContent.MemberList:
      case HeaderContent.ManageGroupMembers:
        return <h3>{lang('GroupMembers')}</h3>;
      case HeaderContent.ManageReactions:
        return <h3>{lang('Reactions')}</h3>;
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
              {canViewStatistics && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('Statistics')}
                  onClick={toggleStatistics}
                >
                  <i className="icon-stats" />
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
    (shouldSkipTransition || shouldSkipHistoryAnimations) && 'no-transition',
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
        name={(shouldSkipTransition || shouldSkipHistoryAnimations) ? 'none' : 'slide-fade'}
        activeKey={renderingContentKey}
      >
        {renderHeaderContent()}
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
    const isEditingInvite = Boolean(chatId && global.management.byChatId[chatId]?.editingInvite);
    const canViewStatistics = chat?.fullInfo?.canViewStatistics;
    const currentInviteInfo = chatId ? global.management.byChatId[chatId]?.inviteInfo?.invite : undefined;

    return {
      canManage,
      canAddContact,
      canViewStatistics,
      isChannel,
      userId: user?.id,
      messageSearchQuery,
      stickerSearchQuery,
      gifSearchQuery,
      isEditingInvite,
      currentInviteInfo,
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
    };
  },
)(RightHeader));
