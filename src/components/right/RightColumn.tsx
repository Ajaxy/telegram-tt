import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ProfileTabType, ThreadId } from '../../types';
import {
  ManagementScreens, NewChatMembersProgress, ProfileState, RightColumnContent,
} from '../../types';

import { ANIMATION_END_DELAY, MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import { getIsSavedDialog } from '../../global/helpers';
import {
  selectAreActiveChatsLoaded,
  selectCurrentMessageList,
  selectIsChatWithSelf,
  selectRightColumnContentKey,
  selectTabState,
} from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLastCallback from '../../hooks/useLastCallback';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useWindowSize from '../../hooks/window/useWindowSize';

import Transition from '../ui/Transition';
import AddChatMembers from './AddChatMembers';
import CreateTopic from './CreateTopic.async';
import EditTopic from './EditTopic.async';
import GifSearch from './GifSearch.async';
import Management from './management/Management.async';
import PollResults from './PollResults.async';
import Profile from './Profile';
import RightHeader from './RightHeader';
import BoostStatistics from './statistics/BoostStatistics';
import MessageStatistics from './statistics/MessageStatistics.async';
import MonetizationStatistics from './statistics/MonetizationStatistics';
import Statistics from './statistics/Statistics.async';
import StoryStatistics from './statistics/StoryStatistics.async';
import StickerSearch from './StickerSearch.async';

import './RightColumn.scss';

interface OwnProps {
  isMobile?: boolean;
}

type StateProps = {
  contentKey?: RightColumnContent;
  chatId?: string;
  threadId?: ThreadId;
  isInsideTopic?: boolean;
  isChatSelected: boolean;
  shouldSkipHistoryAnimations?: boolean;
  nextManagementScreen?: ManagementScreens;
  nextProfileTab?: ProfileTabType;
  shouldCloseRightColumn?: boolean;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
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
  isChatSelected,
  shouldSkipHistoryAnimations,
  nextManagementScreen,
  nextProfileTab,
  shouldCloseRightColumn,
  isSavedMessages,
  isSavedDialog,
}) => {
  const {
    toggleChatInfo,
    toggleManagement,
    setStickerSearchQuery,
    setGifSearchQuery,
    closePollResults,
    addChatMembers,
    setNewChatMembersDialogState,
    setEditingExportedInvite,
    toggleStatistics,
    toggleMessageStatistics,
    toggleStoryStatistics,
    setOpenedInviteInfo,
    requestNextManagementScreen,
    resetNextProfileTab,
    closeCreateTopicPanel,
    closeEditTopicPanel,
    closeBoostStatistics,
    setShouldCloseRightColumn,
    closeMonetizationStatistics,
  } = getActions();

  const { width: windowWidth } = useWindowSize();
  const [profileState, setProfileState] = useState<ProfileState>(
    isSavedMessages && !isSavedDialog ? ProfileState.SavedDialogs : ProfileState.Profile,
  );
  const [managementScreen, setManagementScreen] = useState<ManagementScreens>(ManagementScreens.Initial);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState<string | undefined>();
  const [isPromotedByCurrentUser, setIsPromotedByCurrentUser] = useState<boolean | undefined>();
  const isScrolledDown = profileState !== ProfileState.Profile;

  const isOpen = contentKey !== undefined;
  const isProfile = contentKey === RightColumnContent.ChatInfo;
  const isManagement = contentKey === RightColumnContent.Management;
  const isStatistics = contentKey === RightColumnContent.Statistics;
  const isMessageStatistics = contentKey === RightColumnContent.MessageStatistics;
  const isStoryStatistics = contentKey === RightColumnContent.StoryStatistics;
  const isBoostStatistics = contentKey === RightColumnContent.BoostStatistics;
  const isMonetizationStatistics = contentKey === RightColumnContent.MonetizationStatistics;
  const isStickerSearch = contentKey === RightColumnContent.StickerSearch;
  const isGifSearch = contentKey === RightColumnContent.GifSearch;
  const isPollResults = contentKey === RightColumnContent.PollResults;
  const isAddingChatMembers = contentKey === RightColumnContent.AddingMembers;
  const isCreatingTopic = contentKey === RightColumnContent.CreateTopic;
  const isEditingTopic = contentKey === RightColumnContent.EditTopic;
  const isOverlaying = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN;

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isOpen);

  const renderingContentKey = useCurrentOrPrev(contentKey, true, !isChatSelected) ?? -1;

  const close = useLastCallback((shouldScrollUp = true) => {
    switch (contentKey) {
      case RightColumnContent.AddingMembers:
        setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.Closed });
        break;
      case RightColumnContent.ChatInfo:
        if (isScrolledDown && shouldScrollUp && !isSavedMessages) {
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
      case RightColumnContent.StoryStatistics:
        toggleStoryStatistics();
        break;
      case RightColumnContent.Statistics:
        toggleStatistics();
        break;
      case RightColumnContent.BoostStatistics:
        closeBoostStatistics();
        break;
      case RightColumnContent.MonetizationStatistics:
        closeMonetizationStatistics();
        break;
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
  });

  const handleSelectChatMember = useLastCallback((memberId, isPromoted) => {
    setSelectedChatMemberId(memberId);
    setIsPromotedByCurrentUser(isPromoted);
  });

  const handleAppendingChatMembers = useLastCallback((memberIds: string[]) => {
    addChatMembers({ chatId: chatId!, memberIds });
  });

  useEffect(() => (isOpen && chatId ? captureEscKeyListener(close) : undefined), [isOpen, close, chatId]);

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
  }, [nextManagementScreen]);

  useEffect(() => {
    if (!nextProfileTab) return;

    resetNextProfileTab();
  }, [nextProfileTab]);

  useEffect(() => {
    if (shouldCloseRightColumn) {
      close();
      setShouldCloseRightColumn({ value: undefined });
    }
  }, [shouldCloseRightColumn]);

  // Close Right Column when it transforms into overlayed state on screen resize
  useEffect(() => {
    if (isOpen && isOverlaying) {
      close();
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [isOverlaying]);

  // We need to clear profile state and management screen state, when changing chats
  useLayoutEffectWithPrevDeps(([prevChatId, prevThreadId]) => {
    if (prevChatId !== chatId || prevThreadId !== threadId) {
      setProfileState(
        isSavedMessages && !isSavedDialog ? ProfileState.SavedDialogs : ProfileState.Profile,
      );
      setManagementScreen(ManagementScreens.Initial);
    }
  }, [chatId, threadId, isSavedDialog, isSavedMessages]);

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
            key={`add_chat_members_${chatId!}`}
            chatId={chatId!}
            isActive={isOpen && isActive}
            onNextStep={handleAppendingChatMembers}
            onClose={close}
          />
        );
      case RightColumnContent.ChatInfo:
        return (
          <Profile
            key={`profile_${chatId!}_${threadId}`}
            chatId={chatId!}
            threadId={threadId}
            profileState={profileState}
            isMobile={isMobile}
            isActive={isOpen && isActive}
            onProfileStateChange={setProfileState}
          />
        );
      case RightColumnContent.Management:
        return (
          <Management
            key={`management_${chatId!}_${managementScreen}`}
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
      case RightColumnContent.BoostStatistics:
        return <BoostStatistics />;
      case RightColumnContent.MonetizationStatistics:
        return <MonetizationStatistics />;
      case RightColumnContent.MessageStatistics:
        return <MessageStatistics chatId={chatId!} isActive={isOpen && isActive} />;
      case RightColumnContent.StoryStatistics:
        return <StoryStatistics chatId={chatId!} isActive={isOpen && isActive} />;
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
          isManagement={isManagement}
          isStatistics={isStatistics}
          isBoostStatistics={isBoostStatistics}
          isMonetizationStatistics={isMonetizationStatistics}
          isMessageStatistics={isMessageStatistics}
          isStoryStatistics={isStoryStatistics}
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
          name={(shouldSkipTransition || shouldSkipHistoryAnimations) ? 'none' : 'zoomFade'}
          renderCount={MAIN_SCREENS_COUNT + MANAGEMENT_SCREENS_COUNT}
          activeKey={isManagement ? MAIN_SCREENS_COUNT + managementScreen : renderingContentKey}
          shouldCleanup
          cleanupExceptionKey={
            (renderingContentKey === RightColumnContent.MessageStatistics
              || renderingContentKey === RightColumnContent.StoryStatistics)
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
    const {
      management, shouldSkipHistoryAnimations, nextProfileTab, shouldCloseRightColumn,
    } = selectTabState(global);
    const nextManagementScreen = chatId ? management.byChatId[chatId]?.nextScreen : undefined;

    const isSavedMessages = chatId ? selectIsChatWithSelf(global, chatId) : undefined;
    const isSavedDialog = chatId ? getIsSavedDialog(chatId, threadId, global.currentUserId) : undefined;

    return {
      contentKey: selectRightColumnContentKey(global, isMobile),
      chatId,
      threadId,
      isChatSelected: Boolean(chatId && areActiveChatsLoaded),
      shouldSkipHistoryAnimations,
      nextManagementScreen,
      nextProfileTab,
      shouldCloseRightColumn,
      isSavedMessages,
      isSavedDialog,
    };
  },
)(RightColumn));
