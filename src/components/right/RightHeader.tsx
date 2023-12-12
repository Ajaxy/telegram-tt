import type { FC } from '../../lib/teact/teact';
import React, { useEffect, useRef, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiExportedInvite } from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import { ManagementScreens, ProfileState } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import {
  getCanAddContact, getCanManageTopic, isChatChannel, isUserBot, isUserId,
} from '../../global/helpers';
import {
  selectCanManage,
  selectChat,
  selectChatFullInfo,
  selectCurrentGifSearch,
  selectCurrentStickerSearch,
  selectCurrentTextSearch,
  selectTabState,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getDayStartAt } from '../../util/dateFormat';
import { debounce } from '../../util/schedulers';

import useAppLayout from '../../hooks/useAppLayout';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useElectronDrag from '../../hooks/useElectronDrag';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import ConfirmDialog from '../ui/ConfirmDialog';
import SearchInput from '../ui/SearchInput';
import Transition from '../ui/Transition';

import './RightHeader.scss';

type OwnProps = {
  chatId?: string;
  threadId?: number;
  isColumnOpen?: boolean;
  isProfile?: boolean;
  isSearch?: boolean;
  isManagement?: boolean;
  isStatistics?: boolean;
  isBoostStatistics?: boolean;
  isMessageStatistics?: boolean;
  isStoryStatistics?: boolean;
  isStickerSearch?: boolean;
  isGifSearch?: boolean;
  isPollResults?: boolean;
  isCreatingTopic?: boolean;
  isEditingTopic?: boolean;
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
  isSelf?: boolean;
  messageSearchQuery?: string;
  stickerSearchQuery?: string;
  gifSearchQuery?: string;
  isEditingInvite?: boolean;
  currentInviteInfo?: ApiExportedInvite;
  shouldSkipHistoryAnimations?: boolean;
  isBot?: boolean;
  isInsideTopic?: boolean;
  canEditTopic?: boolean;
};

const COLUMN_ANIMATION_DURATION = 450 + ANIMATION_END_DELAY;
const runDebouncedForSearch = debounce((cb) => cb(), 200, false);

enum HeaderContent {
  Profile,
  MemberList,
  SharedMedia,
  StoryList,
  Search,
  Statistics,
  MessageStatistics,
  StoryStatistics,
  BoostStatistics,
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
}

const RightHeader: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isColumnOpen,
  isProfile,
  isSearch,
  isManagement,
  isStatistics,
  isMessageStatistics,
  isStoryStatistics,
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
  messageSearchQuery,
  stickerSearchQuery,
  gifSearchQuery,
  isEditingInvite,
  canViewStatistics,
  currentInviteInfo,
  shouldSkipHistoryAnimations,
  isBot,
  isInsideTopic,
  canEditTopic,
  onClose,
  onScreenSelect,
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
    openEditTopicPanel,
  } = getActions();

  const [isDeleteDialogOpen, openDeleteDialog, closeDeleteDialog] = useFlag();
  const { isMobile } = useAppLayout();

  const handleEditInviteClick = useLastCallback(() => {
    setEditingExportedInvite({ chatId: chatId!, invite: currentInviteInfo! });
    onScreenSelect(ManagementScreens.EditInvite);
  });

  const handleDeleteInviteClick = useLastCallback(() => {
    deleteExportedChatInvite({ chatId: chatId!, link: currentInviteInfo!.link });
    onScreenSelect(ManagementScreens.Invites);
    closeDeleteDialog();
  });

  const handleMessageSearchQueryChange = useLastCallback((query: string) => {
    setLocalTextSearchQuery({ query });

    if (query.length) {
      runDebouncedForSearch(searchTextMessagesLocal);
    }
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
    openEditTopicPanel({ chatId, topicId: threadId });
  });

  const handleToggleManagement = useLastCallback(() => {
    toggleManagement();
  });

  const handleToggleStatistics = useLastCallback(() => {
    toggleStatistics();
  });

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
    ) : profileState === ProfileState.StoryList ? (
      HeaderContent.StoryList
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
  ) : undefined; // When column is closed

  const renderingContentKey = useCurrentOrPrev(contentKey, true) ?? -1;

  function getHeaderTitle() {
    if (isInsideTopic) {
      return lang('AccDescrTopic');
    }

    if (isChannel) {
      return lang('Channel.TitleInfo');
    }

    if (userId) {
      return lang(isBot ? 'lng_info_bot_title' : 'lng_info_user_title');
    }

    return lang('GroupInfo.Title');
  }

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
              <i className="icon icon-calendar" />
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
                  <i className="icon icon-edit" />
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
                    <i className="icon icon-delete" />
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
      case HeaderContent.MessageStatistics:
        return <h3>{lang('Stats.MessageTitle')}</h3>;
      case HeaderContent.StoryStatistics:
        return <h3>{lang('Stats.StoryTitle')}</h3>;
      case HeaderContent.BoostStatistics:
        return <h3>{lang('Boosts')}</h3>;
      case HeaderContent.SharedMedia:
        return <h3>{lang('SharedMedia')}</h3>;
      case HeaderContent.ManageChannelSubscribers:
        return <h3>{lang('ChannelSubscribers')}</h3>;
      case HeaderContent.MemberList:
      case HeaderContent.ManageGroupMembers:
        return <h3>{lang('GroupMembers')}</h3>;
      case HeaderContent.StoryList:
        return <h3>{lang(isSelf ? 'Settings.MyStories' : 'PeerInfo.PaneStories')}</h3>;
      case HeaderContent.ManageReactions:
        return <h3>{lang('Reactions')}</h3>;
      case HeaderContent.CreateTopic:
        return <h3>{lang('NewTopic')}</h3>;
      case HeaderContent.EditTopic:
        return <h3>{lang('EditTopic')}</h3>;
      default:
        return (
          <>
            <h3>{getHeaderTitle()}
            </h3>
            <section className="tools">
              {canAddContact && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('AddContact')}
                  onClick={handleAddContact}
                >
                  <i className="icon icon-add-user" aria-hidden />
                </Button>
              )}
              {canManage && !isInsideTopic && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('Edit')}
                  onClick={handleToggleManagement}
                >
                  <i className="icon icon-edit" />
                </Button>
              )}
              {canEditTopic && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('EditTopic')}
                  onClick={toggleEditTopic}
                >
                  <i className="icon icon-edit" />
                </Button>
              )}
              {canViewStatistics && (
                <Button
                  round
                  color="translucent"
                  size="smaller"
                  ariaLabel={lang('Statistics')}
                  onClick={handleToggleStatistics}
                >
                  <i className="icon icon-stats" />
                </Button>
              )}
            </section>
          </>
        );
    }
  }

  const isBackButton = (
    isMobile
    || contentKey === HeaderContent.SharedMedia
    || contentKey === HeaderContent.MemberList
    || contentKey === HeaderContent.StoryList
    || contentKey === HeaderContent.AddingMembers
    || contentKey === HeaderContent.MessageStatistics
    || contentKey === HeaderContent.StoryStatistics
    || isManagement
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
        onClick={onClose}
        ariaLabel={isBackButton ? lang('Common.Back') : lang('Common.Close')}
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
    const { query: messageSearchQuery } = selectCurrentTextSearch(global) || {};
    const { query: stickerSearchQuery } = selectCurrentStickerSearch(global) || {};
    const { query: gifSearchQuery } = selectCurrentGifSearch(global) || {};
    const chat = chatId ? selectChat(global, chatId) : undefined;
    const user = isProfile && chatId && isUserId(chatId) ? selectUser(global, chatId) : undefined;
    const isChannel = chat && isChatChannel(chat);
    const isInsideTopic = chat?.isForum && Boolean(threadId && threadId !== MAIN_THREAD_ID);
    const topic = isInsideTopic ? chat.topics?.[threadId!] : undefined;
    const canEditTopic = isInsideTopic && topic && getCanManageTopic(chat, topic);
    const isBot = user && isUserBot(user);

    const canAddContact = user && getCanAddContact(user);
    const canManage = Boolean(!isManagement && isProfile && chatId && selectCanManage(global, chatId));

    const isEditingInvite = Boolean(chatId && tabState.management.byChatId[chatId]?.editingInvite);
    const canViewStatistics = !isInsideTopic && chatId
      ? selectChatFullInfo(global, chatId)?.canViewStatistics
      : undefined;
    const currentInviteInfo = chatId
      ? tabState.management.byChatId[chatId]?.inviteInfo?.invite : undefined;

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
      messageSearchQuery,
      stickerSearchQuery,
      gifSearchQuery,
      isEditingInvite,
      currentInviteInfo,
      shouldSkipHistoryAnimations: tabState.shouldSkipHistoryAnimations,
    };
  },
)(RightHeader);
