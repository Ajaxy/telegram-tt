import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import {
  ManagementScreens, NewChatMembersProgress, ProfileState, RightColumnContent,
} from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';

import { ANIMATION_END_DELAY, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import {
  selectAreActiveChatsLoaded,
  selectChat,
  selectCurrentMessageList, selectTabState,
  selectRightColumnContentKey,
} from '../../global/selectors';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useWindowSize from '../../hooks/useWindowSize';
import useHistoryBack from '../../hooks/useHistoryBack';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import RightHeader from './RightHeader';
import Profile from './Profile';
import Transition from '../ui/Transition';
import RightSearch from './RightSearch.async';
import Management from './management/Management.async';
import Statistics from './statistics/Statistics.async';
import MessageStatistics from './statistics/MessageStatistics.async';
import StickerSearch from './StickerSearch.async';
import GifSearch from './GifSearch.async';
import PollResults from './PollResults.async';
import AddChatMembers from './AddChatMembers';
import CreateTopic from './CreateTopic.async';
import EditTopic from './EditTopic.async';

import './RightColumn.scss';

interface OwnProps {
  isMobile?: boolean;
}

type StateProps = {
  contentKey?: RightColumnContent;
  chatId?: string;
  threadId?: number;
  isInsideTopic?: boolean;
  isChatSelected: boolean;
  shouldSkipHistoryAnimations?: boolean;
  nextManagementScreen?: ManagementScreens;
};

const ANIMATION_DURATION = 450 + ANIMATION_END_DELAY;
const MAIN_SCREENS_COUNT = Object.keys(RightColumnContent).length / 2;
const MANAGEMENT_SCREENS_COUNT = Object.keys(ManagementScreens).length / 2;

function blurSearchInput() {
  const searchInput = document.querySelector('.RightHeader .SearchInput input') as HTMLInputElement;
  if (searchInput) {
    searchInput.blur();
  }
}

const RightColumn: FC<OwnProps & StateProps> = ({
  contentKey,
  chatId,
  threadId,
  isMobile,
  isInsideTopic,
  isChatSelected,
  shouldSkipHistoryAnimations,
  nextManagementScreen,
}) => {
  const {
    toggleChatInfo,
    toggleManagement,
    closeLocalTextSearch,
    setStickerSearchQuery,
    setGifSearchQuery,
    closePollResults,
    addChatMembers,
    setNewChatMembersDialogState,
    setEditingExportedInvite,
    toggleStatistics,
    toggleMessageStatistics,
    setOpenedInviteInfo,
    requestNextManagementScreen,
    closeCreateTopicPanel,
    closeEditTopicPanel,
  } = getActions();

  const { width: windowWidth } = useWindowSize();
  const [profileState, setProfileState] = useState<ProfileState>(ProfileState.Profile);
  const [managementScreen, setManagementScreen] = useState<ManagementScreens>(ManagementScreens.Initial);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState<string | undefined>();
  const [isPromotedByCurrentUser, setIsPromotedByCurrentUser] = useState<boolean | undefined>();
  const isScrolledDown = profileState !== ProfileState.Profile;

  const isOpen = contentKey !== undefined;
  const isProfile = contentKey === RightColumnContent.ChatInfo;
  const isSearch = contentKey === RightColumnContent.Search;
  const isManagement = contentKey === RightColumnContent.Management;
  const isStatistics = contentKey === RightColumnContent.Statistics;
  const isMessageStatistics = contentKey === RightColumnContent.MessageStatistics;
  const isStickerSearch = contentKey === RightColumnContent.StickerSearch;
  const isGifSearch = contentKey === RightColumnContent.GifSearch;
  const isPollResults = contentKey === RightColumnContent.PollResults;
  const isAddingChatMembers = contentKey === RightColumnContent.AddingMembers;
  const isCreatingTopic = contentKey === RightColumnContent.CreateTopic;
  const isEditingTopic = contentKey === RightColumnContent.EditTopic;
  const isOverlaying = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN;

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isOpen);

  const renderingContentKey = useCurrentOrPrev(contentKey, true, !isChatSelected) ?? -1;

  const close = useCallback((shouldScrollUp = true) => {
    switch (contentKey) {
      case RightColumnContent.AddingMembers:
        setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Closed });
        break;
      case RightColumnContent.ChatInfo:
        if (isScrolledDown && shouldScrollUp) {
          setProfileState(ProfileState.Profile);
          break;
        }
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        break;
      case RightColumnContent.Management: {
        switch (managementScreen) {
          case ManagementScreens.Initial:
            toggleManagement();
            break;
          case ManagementScreens.ChatPrivacyType:
          case ManagementScreens.Discussion:
          case ManagementScreens.GroupPermissions:
          case ManagementScreens.GroupType:
          case ManagementScreens.ChatAdministrators:
          case ManagementScreens.ChannelSubscribers:
          case ManagementScreens.GroupMembers:
          case ManagementScreens.Invites:
          case ManagementScreens.Reactions:
          case ManagementScreens.JoinRequests:
          case ManagementScreens.ChannelRemovedUsers:
            setManagementScreen(ManagementScreens.Initial);
            break;
          case ManagementScreens.GroupUserPermissionsCreate:
          case ManagementScreens.GroupRemovedUsers:
          case ManagementScreens.GroupUserPermissions:
            setManagementScreen(ManagementScreens.GroupPermissions);
            setSelectedChatMemberId(undefined);
            setIsPromotedByCurrentUser(undefined);
            break;
          case ManagementScreens.ChatAdminRights:
          case ManagementScreens.ChatNewAdminRights:
          case ManagementScreens.GroupAddAdmins:
          case ManagementScreens.GroupRecentActions:
            setManagementScreen(ManagementScreens.ChatAdministrators);
            break;
          case ManagementScreens.EditInvite:
          case ManagementScreens.InviteInfo:
            setManagementScreen(ManagementScreens.Invites);
            setOpenedInviteInfo({ chatId: chatId!, invite: undefined });
            setEditingExportedInvite({ chatId: chatId!, invite: undefined });
            break;
        }

        break;
      }
      case RightColumnContent.MessageStatistics:
        toggleMessageStatistics();
        break;
      case RightColumnContent.Statistics:
        toggleStatistics();
        break;
      case RightColumnContent.Search: {
        blurSearchInput();
        closeLocalTextSearch();
        break;
      }
      case RightColumnContent.StickerSearch:
        blurSearchInput();
        setStickerSearchQuery({ query: undefined });
        break;
      case RightColumnContent.GifSearch: {
        blurSearchInput();
        setGifSearchQuery({ query: undefined });
        break;
      }
      case RightColumnContent.PollResults:
        closePollResults();
        break;
      case RightColumnContent.CreateTopic:
        closeCreateTopicPanel();
        break;
      case RightColumnContent.EditTopic:
        closeEditTopicPanel();
        break;
    }
  }, [
    contentKey, isScrolledDown, toggleChatInfo, closePollResults, setNewChatMembersDialogState,
    managementScreen, toggleManagement, closeLocalTextSearch, setStickerSearchQuery, setGifSearchQuery,
    setEditingExportedInvite, chatId, setOpenedInviteInfo, toggleStatistics, toggleMessageStatistics,
    closeCreateTopicPanel, closeEditTopicPanel,
  ]);

  const handleSelectChatMember = useCallback((memberId, isPromoted) => {
    setSelectedChatMemberId(memberId);
    setIsPromotedByCurrentUser(isPromoted);
  }, []);

  const handleAppendingChatMembers = useCallback((memberIds: string[]) => {
    addChatMembers({ chatId: chatId!, memberIds });
  }, [addChatMembers, chatId]);

  useEffect(() => (isOpen ? captureEscKeyListener(close) : undefined), [isOpen, close]);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isOpen);
    }, ANIMATION_DURATION);
  }, [isOpen]);

  useEffect(() => {
    if (nextManagementScreen) {
      setManagementScreen(nextManagementScreen);
      requestNextManagementScreen(undefined);
    }
  }, [nextManagementScreen, requestNextManagementScreen]);

  // Close Right Column when it transforms into overlayed state on screen resize
  useEffect(() => {
    if (isOpen && isOverlaying) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlaying]);

  // We need to clear profile state and management screen state, when changing chats
  useLayoutEffectWithPrevDeps(([prevChatId]) => {
    if (prevChatId !== chatId) {
      setProfileState(ProfileState.Profile);
      setManagementScreen(ManagementScreens.Initial);
    }
  }, [chatId]);

  useHistoryBack({
    isActive: isChatSelected && (
      contentKey === RightColumnContent.ChatInfo
      || contentKey === RightColumnContent.Management
      || contentKey === RightColumnContent.AddingMembers
      || contentKey === RightColumnContent.CreateTopic
      || contentKey === RightColumnContent.EditTopic),
    onBack: () => close(false),
  });

  function renderContent(isActive: boolean) {
    if (renderingContentKey === -1) {
      return undefined;
    }

    switch (renderingContentKey) {
      case RightColumnContent.AddingMembers:
        return (
          <AddChatMembers
            key={chatId!}
            chatId={chatId!}
            isActive={isOpen && isActive}
            onNextStep={handleAppendingChatMembers}
            onClose={close}
          />
        );
      case RightColumnContent.ChatInfo:
        return (
          <Profile
            key={chatId!}
            chatId={chatId!}
            topicId={isInsideTopic ? threadId : undefined}
            profileState={profileState}
            isMobile={isMobile}
            onProfileStateChange={setProfileState}
          />
        );
      case RightColumnContent.Search:
        return <RightSearch chatId={chatId!} threadId={threadId!} onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.Management:
        return (
          <Management
            key={chatId!}
            chatId={chatId!}
            currentScreen={managementScreen}
            isPromotedByCurrentUser={isPromotedByCurrentUser}
            selectedChatMemberId={selectedChatMemberId}
            isActive={isOpen && isActive}
            onScreenSelect={setManagementScreen}
            onChatMemberSelect={handleSelectChatMember}
            onClose={close}
          />
        );

      case RightColumnContent.Statistics:
        return <Statistics chatId={chatId!} />;
      case RightColumnContent.MessageStatistics:
        return <MessageStatistics chatId={chatId!} isActive={isOpen && isActive} />;
      case RightColumnContent.StickerSearch:
        return <StickerSearch onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.GifSearch:
        return <GifSearch onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.PollResults:
        return <PollResults onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.CreateTopic:
        return <CreateTopic onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.EditTopic:
        return <EditTopic onClose={close} isActive={isOpen && isActive} />;
    }

    return undefined; // Unreachable
  }

  return (
    <div
      id="RightColumn-wrapper"
      className={!isChatSelected ? 'is-hidden' : undefined}
    >
      {isOverlaying && (
        <div className="overlay-backdrop" onClick={close} />
      )}
      <div id="RightColumn">
        <RightHeader
          chatId={chatId}
          threadId={threadId}
          isColumnOpen={isOpen}
          isProfile={isProfile}
          isSearch={isSearch}
          isManagement={isManagement}
          isStatistics={isStatistics}
          isMessageStatistics={isMessageStatistics}
          isStickerSearch={isStickerSearch}
          isGifSearch={isGifSearch}
          isPollResults={isPollResults}
          isCreatingTopic={isCreatingTopic}
          isEditingTopic={isEditingTopic}
          isAddingChatMembers={isAddingChatMembers}
          profileState={profileState}
          managementScreen={managementScreen}
          onClose={close}
          onScreenSelect={setManagementScreen}
        />
        <Transition
          name={(shouldSkipTransition || shouldSkipHistoryAnimations) ? 'none' : 'zoom-fade'}
          renderCount={MAIN_SCREENS_COUNT + MANAGEMENT_SCREENS_COUNT}
          activeKey={isManagement ? MAIN_SCREENS_COUNT + managementScreen : renderingContentKey}
          shouldCleanup
          cleanupExceptionKey={
            renderingContentKey === RightColumnContent.MessageStatistics
              ? RightColumnContent.Statistics : undefined
          }
        >
          {renderContent}
        </Transition>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { isMobile }): StateProps => {
    const { chatId, threadId } = selectCurrentMessageList(global) || {};
    const areActiveChatsLoaded = selectAreActiveChatsLoaded(global);
    const { management, shouldSkipHistoryAnimations } = selectTabState(global);
    const nextManagementScreen = chatId ? management.byChatId[chatId]?.nextScreen : undefined;
    const isForum = chatId ? selectChat(global, chatId)?.isForum : undefined;
    const isInsideTopic = isForum && Boolean(threadId && threadId !== MAIN_THREAD_ID);

    return {
      contentKey: selectRightColumnContentKey(global, isMobile),
      chatId,
      threadId,
      isInsideTopic,
      isChatSelected: Boolean(chatId && areActiveChatsLoaded),
      shouldSkipHistoryAnimations,
      nextManagementScreen,
    };
  },
)(RightColumn));
