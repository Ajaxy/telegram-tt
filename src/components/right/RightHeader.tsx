import type { FC } from '../../lib/teact/teact';
import React, {
  useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiExportedInvite } from '../../api/types';
import type { GiftProfileFilterOptions, ThreadId } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';
import { ManagementScreens, ProfileState } from '../../types';

import { ANIMATION_END_DELAY, SAVED_FOLDER_ID } from '../../config';
import {
  getCanAddContact, getCanManageTopic, isChatChannel, isUserBot, isUserId,
} from '../../global/helpers';
import {
  selectCanManage,
  selectCanUseGiftProfileAdminFilter,
  selectCanUseGiftProfileFilter,
  selectChat,
  selectChatFullInfo,
  selectCurrentGifSearch,
  selectCurrentStickerSearch,
  selectIsChatWithSelf,
  selectTabState,
  selectTopic,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useAppLayout from '../../hooks/useAppLayout';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useElectronDrag from '../../hooks/useElectronDrag';
import useFlag from '../../hooks/useFlag';
import { useFolderManagerForChatsCount } from '../../hooks/useFolderManager';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import SearchInput from '../ui/SearchInput';
import Transition from '../ui/Transition';

import './RightHeader.scss';

type OwnProps = {
  chatId?: string;
  threadId?: ThreadId;
  isColumnOpen?: boolean;
  isProfile?: boolean;
  isManagement?: boolean;
  isStatistics?: boolean;
  isBoostStatistics?: boolean;
  isMessageStatistics?: boolean;
  isMonetizationStatistics?: boolean;
  isStoryStatistics?: boolean;
  isStickerSearch?: boolean;
  isGifSearch?: boolean;
  isPollResults?: boolean;
  isCreatingTopic?: boolean;
  isEditingTopic?: boolean;
  isAddingChatMembers?: boolean;
  profileState?: ProfileState;
  managementScreen?: ManagementScreens;
  onClose: (shouldScrollUp?: boolean) => void;
  onScreenSelect: (screen: ManagementScreens) => void;
};

type StateProps = {
  canAddContact?: boolean;
  canManage?: boolean;
  canViewStatistics?: boolean;
  isChannel?: boolean;
  userId?: string;
  isSelf?: boolean;
  stickerSearchQuery?: string;
  gifSearchQuery?: string;
  isEditingInvite?: boolean;
  currentInviteInfo?: ApiExportedInvite;
  shouldSkipHistoryAnimations?: boolean;
  isBot?: boolean;
  canEditBot?: boolean;
  giftProfileFilter: GiftProfileFilterOptions;
  canUseGiftFilter?: boolean;
  canUseGiftAdminFilter?:boolean;
  isInsideTopic?: boolean;
  canEditTopic?: boolean;
  isSavedMessages?: boolean;
};

const COLUMN_ANIMATION_DURATION = 450 + ANIMATION_END_DELAY;

enum HeaderContent {
  Profile,
  MemberList,
  GiftList,
  SharedMedia,
  StoryList,
  Search,
  Statistics,
  MessageStatistics,
  StoryStatistics,
  BoostStatistics,
  MonetizationStatistics,
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
  CreateTopic,
  EditTopic,
  SavedDialogs,
}

const RightHeader: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isColumnOpen,
  isProfile,
  isManagement,
  isStatistics,
  isMessageStatistics,
  isStoryStatistics,
  isMonetizationStatistics,
  isBoostStatistics,
  isStickerSearch,
  isGifSearch,
  isPollResults,
  isCreatingTopic,
  isEditingTopic,
  isAddingChatMembers,
  profileState,
  managementScreen,
  canAddContact,
  userId,
  isSelf,
  canManage,
  isChannel,
  stickerSearchQuery,
  gifSearchQuery,
  isEditingInvite,
  canViewStatistics,
  currentInviteInfo,
  shouldSkipHistoryAnimations,
  isBot,
  isInsideTopic,
  canEditTopic,
  isSavedMessages,
  onClose,
  onScreenSelect,
  canEditBot,
  giftProfileFilter,
  canUseGiftFilter,
  canUseGiftAdminFilter,
}) => {
  const {
    setStickerSearchQuery,
    setGifSearchQuery,
    toggleManagement,
    openAddContactDialog,
    toggleStatistics,
    setEditingExportedInvite,
    deleteExportedChatInvite,
    openEditTopicPanel,
    updateGiftProfileFilter,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const { isMobile } = useAppLayout();

  const {
    sortType: giftsSortType,
    shouldIncludeUnlimited: shouldIncludeUnlimitedGifts,
    shouldIncludeLimited: shouldIncludeLimitedGifts,
    shouldIncludeUnique: shouldIncludeUniqueGifts,
    shouldIncludeDisplayed: shouldIncludeDisplayedGifts,
    shouldIncludeHidden: shouldIncludeHiddenGifts,
  } = giftProfileFilter;

  const foldersChatCount = useFolderManagerForChatsCount();

  const handleEditInviteClick = useLastCallback(() => {
    setEditingExportedInvite({ chatId: chatId!, invite: currentInviteInfo! });
    onScreenSelect(ManagementScreens.EditInvite);
  });

  const handleDeleteInviteClick = useLastCallback(() => {
    deleteExportedChatInvite({ chatId: chatId!, link: currentInviteInfo!.link });
    onScreenSelect(ManagementScreens.Invites);
    closeDeleteDialog();
  });

  const handleStickerSearchQueryChange = useLastCallback((query: string) => {
    setStickerSearchQuery({ query });
  });

  const handleGifSearchQueryChange = useLastCallback((query: string) => {
    setGifSearchQuery({ query });
  });

  const handleAddContact = useLastCallback(() => {
    openAddContactDialog({ userId });
  });

  const toggleEditTopic = useLastCallback(() => {
    if (!chatId || !threadId) return;
    openEditTopicPanel({ chatId, topicId: Number(threadId) });
  });

  const handleToggleManagement = useLastCallback(() => {
    toggleManagement();
  });

  const handleToggleStatistics = useLastCallback(() => {
    toggleStatistics();
  });

  const handleClose = useLastCallback(() => {
    onClose(!isSavedMessages);
  });

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isColumnOpen);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isColumnOpen);
    }, COLUMN_ANIMATION_DURATION);
  }, [isColumnOpen]);

  const oldLang = useOldLang();
  const lang = useLang();
  const contentKey = isProfile ? (
    profileState === ProfileState.Profile ? (
      HeaderContent.Profile
    ) : profileState === ProfileState.SharedMedia ? (
      HeaderContent.SharedMedia
    ) : profileState === ProfileState.MemberList ? (
      HeaderContent.MemberList
    ) : profileState === ProfileState.GiftList ? (
      HeaderContent.GiftList
    ) : profileState === ProfileState.StoryList ? (
      HeaderContent.StoryList
    ) : profileState === ProfileState.SavedDialogs ? (
      HeaderContent.SavedDialogs
    ) : -1 // Never reached
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
  ) : isMessageStatistics ? (
    HeaderContent.MessageStatistics
  ) : isStoryStatistics ? (
    HeaderContent.StoryStatistics
  ) : isBoostStatistics ? (
    HeaderContent.BoostStatistics
  ) : isCreatingTopic ? (
    HeaderContent.CreateTopic
  ) : isEditingTopic ? (
    HeaderContent.EditTopic
  ) : isMonetizationStatistics ? (
    HeaderContent.MonetizationStatistics
  ) : undefined; // When column is closed

  const renderingContentKey = useCurrentOrPrev(contentKey, true) ?? -1;

  function getHeaderTitle() {
    if (isSavedMessages) {
      return oldLang('SavedMessages');
    }

    if (isInsideTopic) {
      return oldLang('AccDescrTopic');
    }

    if (isChannel) {
      return oldLang('Channel.TitleInfo');
    }

    if (userId) {
      return oldLang(isBot ? 'lng_info_bot_title' : 'lng_info_user_title');
    }

    return oldLang('GroupInfo.Title');
  }

  const PrimaryLinkMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel={lang('AccDescrOpenMenu2')}
      >
        <Icon name="more" />
      </Button>
    );
  }, [isMobile, lang]);

  function renderHeaderContent() {
    if (renderingContentKey === -1) {
      return undefined;
    }

    switch (renderingContentKey) {
      case HeaderContent.PollResults:
        return <h3 className="title">{oldLang('PollResults')}</h3>;
      case HeaderContent.AddingMembers:
        return <h3 className="title">{oldLang(isChannel ? 'ChannelAddSubscribers' : 'GroupAddMembers')}</h3>;
      case HeaderContent.ManageInitial:
        return <h3 className="title">{oldLang('Edit')}</h3>;
      case HeaderContent.ManageChatPrivacyType:
        return <h3 className="title">{oldLang(isChannel ? 'ChannelTypeHeader' : 'GroupTypeHeader')}</h3>;
      case HeaderContent.ManageDiscussion:
        return <h3 className="title">{oldLang('Discussion')}</h3>;
      case HeaderContent.ManageChatAdministrators:
        return <h3 className="title">{oldLang('ChannelAdministrators')}</h3>;
      case HeaderContent.ManageGroupRecentActions:
        return <h3 className="title">{oldLang('Group.Info.AdminLog')}</h3>;
      case HeaderContent.ManageGroupAdminRights:
        return <h3 className="title">{oldLang('EditAdminRights')}</h3>;
      case HeaderContent.ManageGroupNewAdminRights:
        return <h3 className="title">{oldLang('SetAsAdmin')}</h3>;
      case HeaderContent.ManageGroupPermissions:
        return <h3 className="title">{oldLang('ChannelPermissions')}</h3>;
      case HeaderContent.ManageGroupRemovedUsers:
        return <h3 className="title">{oldLang('BlockedUsers')}</h3>;
      case HeaderContent.ManageChannelRemovedUsers:
        return <h3 className="title">{oldLang('ChannelBlockedUsers')}</h3>;
      case HeaderContent.ManageGroupUserPermissionsCreate:
        return <h3 className="title">{oldLang('ChannelAddException')}</h3>;
      case HeaderContent.ManageGroupUserPermissions:
        return <h3 className="title">{oldLang('UserRestrictions')}</h3>;
      case HeaderContent.ManageInvites:
        return <h3 className="title">{oldLang('lng_group_invite_title')}</h3>;
      case HeaderContent.ManageEditInvite:
        return <h3 className="title">{isEditingInvite ? oldLang('EditLink') : oldLang('NewLink')}</h3>;
      case HeaderContent.ManageInviteInfo:
        return (
          <>
            <h3 className="title">{oldLang('InviteLink')}</h3>
            <section className="tools">
              {currentInviteInfo && !currentInviteInfo.isRevoked && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('Edit')}
                  onClick={handleEditInviteClick}
                >
                  <Icon name="edit" />
                </Button>
              )}
              {currentInviteInfo && currentInviteInfo.isRevoked && (
                <>
                  <Button
                    round
                    color="danger"
                    size="smaller"
                    ariaLabel={oldLang('Delete')}
                    onClick={openDeleteDialog}
                  >
                    <Icon name="delete" />
                  </Button>
                  <ConfirmDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={closeDeleteDialog}
                    title={oldLang('DeleteLink')}
                    text={oldLang('DeleteLinkHelp')}
                    confirmIsDestructive
                    confirmLabel={oldLang('Delete')}
                    confirmHandler={handleDeleteInviteClick}
                  />
                </>
              )}
            </section>
          </>
        );
      case HeaderContent.ManageJoinRequests:
        return <h3 className="title">{isChannel ? oldLang('SubscribeRequests') : oldLang('MemberRequests')}</h3>;
      case HeaderContent.ManageGroupAddAdmins:
        return <h3 className="title">{oldLang('Channel.Management.AddModerator')}</h3>;
      case HeaderContent.StickerSearch:
        return (
          <SearchInput
            value={stickerSearchQuery}
            placeholder={oldLang('SearchStickersHint')}
            autoFocusSearch
            onChange={handleStickerSearchQueryChange}
          />
        );
      case HeaderContent.GifSearch:
        return (
          <SearchInput
            value={gifSearchQuery}
            placeholder={oldLang('SearchGifsTitle')}
            autoFocusSearch
            onChange={handleGifSearchQueryChange}
          />
        );
      case HeaderContent.Statistics:
        return <h3 className="title">{oldLang(isChannel ? 'ChannelStats.Title' : 'GroupStats.Title')}</h3>;
      case HeaderContent.MessageStatistics:
        return <h3 className="title">{oldLang('Stats.MessageTitle')}</h3>;
      case HeaderContent.StoryStatistics:
        return <h3 className="title">{oldLang('Stats.StoryTitle')}</h3>;
      case HeaderContent.BoostStatistics:
        return <h3 className="title">{oldLang('Boosts')}</h3>;
      case HeaderContent.MonetizationStatistics:
        return <h3 className="title">{oldLang('lng_channel_earn_title')}</h3>;
      case HeaderContent.SharedMedia:
        return <h3 className="title">{oldLang('SharedMedia')}</h3>;
      case HeaderContent.ManageChannelSubscribers:
        return <h3 className="title">{oldLang('ChannelSubscribers')}</h3>;
      case HeaderContent.MemberList:
      case HeaderContent.ManageGroupMembers:
        return <h3 className="title">{oldLang('GroupMembers')}</h3>;
      case HeaderContent.StoryList:
        return <h3 className="title">{oldLang(isSelf ? 'Settings.MyStories' : 'PeerInfo.PaneStories')}</h3>;
      case HeaderContent.SavedDialogs:
        return (
          <div className="header">
            <h3 className="title">{oldLang('SavedMessagesTab')}</h3>
            <div className="subtitle">{oldLang('Chats', foldersChatCount[SAVED_FOLDER_ID])}</div>
          </div>
        );
      case HeaderContent.ManageReactions:
        return <h3 className="title">{oldLang('Reactions')}</h3>;
      case HeaderContent.CreateTopic:
        return <h3 className="title">{oldLang('NewTopic')}</h3>;
      case HeaderContent.EditTopic:
        return <h3 className="title">{oldLang('EditTopic')}</h3>;
      case HeaderContent.GiftList:
        return (
          <>
            <h3 className="title">{lang('ProfileTabGifts')}</h3>
            {canUseGiftFilter && chatId && (
              <section className="tools">
                <DropdownMenu
                  trigger={PrimaryLinkMenuButton}
                  positionX="right"
                  autoClose={false}
                >
                  <MenuItem
                    icon={giftsSortType === 'byDate' ? 'calendar-filter' : 'cash-circle'}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => updateGiftProfileFilter(
                      { peerId: chatId, filter: { sortType: giftsSortType === 'byDate' ? 'byValue' : 'byDate' } },
                    )}
                  >
                    {lang(giftsSortType === 'byDate' ? 'GiftSortByDate' : 'GiftSortByValue')}
                  </MenuItem>

                  <MenuSeparator />

                  <MenuItem
                    icon={shouldIncludeUnlimitedGifts ? 'check' : 'placeholder'}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => updateGiftProfileFilter(
                      { peerId: chatId, filter: { shouldIncludeUnlimited: !shouldIncludeUnlimitedGifts } },
                    )}
                  >
                    {lang('GiftFilterUnlimited')}
                  </MenuItem>

                  <MenuItem
                    icon={shouldIncludeLimitedGifts ? 'check' : 'placeholder'}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => updateGiftProfileFilter(
                      { peerId: chatId, filter: { shouldIncludeLimited: !shouldIncludeLimitedGifts } },
                    )}
                  >
                    {lang('GiftFilterLimited')}
                  </MenuItem>

                  <MenuItem
                    icon={shouldIncludeUniqueGifts ? 'check' : 'placeholder'}
                    // eslint-disable-next-line react/jsx-no-bind
                    onClick={() => updateGiftProfileFilter(
                      { peerId: chatId, filter: { shouldIncludeUnique: !shouldIncludeUniqueGifts } },
                    )}
                  >
                    {lang('GiftFilterUnique')}
                  </MenuItem>

                  {canUseGiftAdminFilter && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        icon={shouldIncludeDisplayedGifts ? 'check' : 'placeholder'}
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => updateGiftProfileFilter(
                          { peerId: chatId, filter: { shouldIncludeDisplayed: !shouldIncludeDisplayedGifts } },
                        )}
                      >
                        {lang('GiftFilterDisplayed')}
                      </MenuItem>

                      <MenuItem
                        icon={shouldIncludeHiddenGifts ? 'check' : 'placeholder'}
                        // eslint-disable-next-line react/jsx-no-bind
                        onClick={() => updateGiftProfileFilter(
                          { peerId: chatId, filter: { shouldIncludeHidden: !shouldIncludeHiddenGifts } },
                        )}
                      >
                        {lang('GiftFilterHidden')}
                      </MenuItem>
                    </>
                  )}
                </DropdownMenu>
              </section>
            )}
          </>
        );
      default:
        return (
          <>
            <h3 className="title">
              {getHeaderTitle()}
            </h3>
            <section className="tools">
              {canAddContact && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('AddContact')}
                  onClick={handleAddContact}
                >
                  <Icon name="add-user" />
                </Button>
              )}
              {canManage && !isInsideTopic && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('Edit')}
                  onClick={handleToggleManagement}
                >
                  <Icon name="edit" />
                </Button>
              )}
              {canEditBot && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('Edit')}
                  onClick={handleToggleManagement}
                >
                  <Icon name="edit" />
                </Button>
              )}
              {canEditTopic && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('EditTopic')}
                  onClick={toggleEditTopic}
                >
                  <Icon name="edit" />
                </Button>
              )}
              {canViewStatistics && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={oldLang('Statistics')}
                  onClick={handleToggleStatistics}
                >
                  <Icon name="stats" />
                </Button>
              )}
            </section>
          </>
        );
    }
  }

  const isBackButton = isMobile || (
    !isSavedMessages && (
      contentKey === HeaderContent.SharedMedia
      || contentKey === HeaderContent.GiftList
      || contentKey === HeaderContent.MemberList
      || contentKey === HeaderContent.StoryList
      || contentKey === HeaderContent.AddingMembers
      || contentKey === HeaderContent.MessageStatistics
      || contentKey === HeaderContent.StoryStatistics
      || isManagement
    )
  );

  const buttonClassName = buildClassName(
    'animated-close-icon',
    isBackButton && 'state-back',
    (shouldSkipTransition || shouldSkipHistoryAnimations) && 'no-transition',
  );

  // eslint-disable-next-line no-null/no-null
  const headerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(headerRef);

  return (
    <div className="RightHeader" ref={headerRef}>
      <Button
        className="close-button"
        round
        color="translucent"
        size="smaller"
        onClick={handleClose}
        ariaLabel={isBackButton ? oldLang('Common.Back') : oldLang('Common.Close')}
      >
        <div className={buttonClassName} />
      </Button>
      <Transition
        name={(shouldSkipTransition || shouldSkipHistoryAnimations) ? 'none' : 'slideFade'}
        activeKey={renderingContentKey}
      >
        {renderHeaderContent()}
      </Transition>
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, {
    chatId, isProfile, isManagement, threadId,
  }): StateProps => {
    const tabState = selectTabState(global);
    const { query: stickerSearchQuery } = selectCurrentStickerSearch(global) || {};
    const { query: gifSearchQuery } = selectCurrentGifSearch(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const user = isProfile && chatId && isUserId(chatId) ? selectUser(global, chatId) : undefined;
    const isChannel = chat && isChatChannel(chat);
    const isInsideTopic = chat?.isForum && Boolean(threadId && threadId !== MAIN_THREAD_ID);
    const topic = isInsideTopic ? selectTopic(global, chatId!, threadId!) : undefined;
    const canEditTopic = isInsideTopic && topic && getCanManageTopic(chat, topic);
    const isBot = user && isUserBot(user);
    const isSavedMessages = chatId ? selectIsChatWithSelf(global, chatId) : undefined;
    const canEditBot = isBot && user?.canEditBot;

    const canAddContact = user && getCanAddContact(user);
    const canManage = Boolean(!isManagement && isProfile && chatId && selectCanManage(global, chatId));

    const isEditingInvite = Boolean(chatId && tabState.management.byChatId[chatId]?.editingInvite);
    const canViewStatistics = !isInsideTopic && chatId
      ? selectChatFullInfo(global, chatId)?.canViewStatistics
      : undefined;
    const currentInviteInfo = chatId
      ? tabState.management.byChatId[chatId]?.inviteInfo?.invite : undefined;

    const giftProfileFilter = tabState.savedGifts.filter;
    const canUseGiftFilter = chatId ? selectCanUseGiftProfileFilter(global, chatId) : false;
    const canUseGiftAdminFilter = chatId ? selectCanUseGiftProfileAdminFilter(global, chatId) : false;

    return {
      canManage,
      canAddContact,
      canViewStatistics,
      isChannel,
      isBot,
      isInsideTopic,
      canEditTopic,
      userId: user?.id,
      isSelf: user?.isSelf,
      stickerSearchQuery,
      gifSearchQuery,
      isEditingInvite,
      currentInviteInfo,
      isSavedMessages,
      shouldSkipHistoryAnimations: tabState.shouldSkipHistoryAnimations,
      canEditBot,
      giftProfileFilter,
      canUseGiftFilter,
      canUseGiftAdminFilter,
    };
  },
)(RightHeader);
