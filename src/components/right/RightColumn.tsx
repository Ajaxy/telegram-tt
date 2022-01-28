import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import {
  ManagementScreens, NewChatMembersProgress, ProfileState, RightColumnContent,
} from '../../types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import {
  selectAreActiveChatsLoaded,
  selectCurrentMessageList,
  selectRightColumnContentKey,
} from '../../modules/selectors';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useWindowSize from '../../hooks/useWindowSize';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useHistoryBack from '../../hooks/useHistoryBack';

import RightHeader from './RightHeader';
import Profile from './Profile';
import Transition from '../ui/Transition';
import RightSearch from './RightSearch.async';
import Management from './management/Management.async';
import StickerSearch from './StickerSearch.async';
import GifSearch from './GifSearch.async';
import PollResults from './PollResults.async';
import AddChatMembers from './AddChatMembers';

import './RightColumn.scss';

type StateProps = {
  contentKey?: RightColumnContent;
  chatId?: string;
  threadId?: number;
  currentProfileUserId?: string;
  isChatSelected: boolean;
  shouldSkipHistoryAnimations?: boolean;
  nextManagementScreen?: ManagementScreens;
};

const COLUMN_CLOSE_DELAY_MS = 300;
const MAIN_SCREENS_COUNT = Object.keys(RightColumnContent).length / 2;
const MANAGEMENT_SCREENS_COUNT = Object.keys(ManagementScreens).length / 2;

function blurSearchInput() {
  const searchInput = document.querySelector('.RightHeader .SearchInput input') as HTMLInputElement;
  if (searchInput) {
    searchInput.blur();
  }
}

const RightColumn: FC<StateProps> = ({
  contentKey,
  chatId,
  threadId,
  currentProfileUserId,
  isChatSelected,
  shouldSkipHistoryAnimations,
  nextManagementScreen,
}) => {
  const {
    toggleChatInfo,
    toggleManagement,
    openUserInfo,
    closeLocalTextSearch,
    setStickerSearchQuery,
    setGifSearchQuery,
    closePollResults,
    addChatMembers,
    setNewChatMembersDialogState,
    setEditingExportedInvite,
    setOpenedInviteInfo,
    requestNextManagementScreen,
  } = getDispatch();

  const { width: windowWidth } = useWindowSize();
  const [profileState, setProfileState] = useState<ProfileState>(ProfileState.Profile);
  const [managementScreen, setManagementScreen] = useState<ManagementScreens>(ManagementScreens.Initial);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState<string | undefined>();
  const [isPromotedByCurrentUser, setIsPromotedByCurrentUser] = useState<boolean | undefined>();
  const isScrolledDown = profileState !== ProfileState.Profile;

  const isOpen = contentKey !== undefined;
  const isProfile = contentKey === RightColumnContent.ChatInfo || contentKey === RightColumnContent.UserInfo;
  const isSearch = contentKey === RightColumnContent.Search;
  const isManagement = contentKey === RightColumnContent.Management;
  const isStickerSearch = contentKey === RightColumnContent.StickerSearch;
  const isGifSearch = contentKey === RightColumnContent.GifSearch;
  const isPollResults = contentKey === RightColumnContent.PollResults;
  const isAddingChatMembers = contentKey === RightColumnContent.AddingMembers;
  const isOverlaying = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN;

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isOpen);

  const renderingContentKey = useCurrentOrPrev(contentKey, true, !isChatSelected) ?? -1;

  const close = useCallback((shouldScrollUp = true) => {
    switch (contentKey) {
      case RightColumnContent.AddingMembers:
        setNewChatMembersDialogState(NewChatMembersProgress.Closed);
        break;
      case RightColumnContent.ChatInfo:
        if (isScrolledDown && shouldScrollUp) {
          setProfileState(ProfileState.Profile);
          break;
        }
        toggleChatInfo(undefined, { forceSyncOnIOs: true });
        break;
      case RightColumnContent.UserInfo:
        if (isScrolledDown && shouldScrollUp) {
          setProfileState(ProfileState.Profile);
          break;
        }
        openUserInfo({ id: undefined }, { forceSyncOnIOs: true });
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
            setOpenedInviteInfo({ invite: undefined });
            setEditingExportedInvite({ chatId, invite: undefined });
            break;
        }

        break;
      }
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
    }
  }, [
    contentKey, isScrolledDown, toggleChatInfo, openUserInfo, closePollResults, setNewChatMembersDialogState,
    managementScreen, toggleManagement, closeLocalTextSearch, setStickerSearchQuery, setGifSearchQuery,
    setEditingExportedInvite, chatId, setOpenedInviteInfo,
  ]);

  const handleSelectChatMember = useCallback((memberId, isPromoted) => {
    setSelectedChatMemberId(memberId);
    setIsPromotedByCurrentUser(isPromoted);
  }, []);

  const handleAppendingChatMembers = useCallback((memberIds: string[]) => {
    addChatMembers({ chatId, memberIds });
  }, [addChatMembers, chatId]);

  useEffect(() => (isOpen ? captureEscKeyListener(close) : undefined), [isOpen, close]);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isOpen);
    }, COLUMN_CLOSE_DELAY_MS);
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
  useLayoutEffectWithPrevDeps(([prevContentKey, prevChatId]) => {
    if (
      (prevContentKey === RightColumnContent.ChatInfo && contentKey === RightColumnContent.UserInfo)
      || (prevContentKey === RightColumnContent.UserInfo && contentKey === RightColumnContent.ChatInfo)
      || (prevChatId !== chatId)
    ) {
      setProfileState(ProfileState.Profile);
      setManagementScreen(ManagementScreens.Initial);
    }
  }, [contentKey, chatId]);

  useHistoryBack(isChatSelected && (contentKey === RightColumnContent.ChatInfo
    || contentKey === RightColumnContent.UserInfo || contentKey === RightColumnContent.Management
    || contentKey === RightColumnContent.AddingMembers),
  () => close(false), toggleChatInfo);

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean) {
    if (renderingContentKey === -1) {
      return undefined;
    }

    switch (renderingContentKey) {
      case RightColumnContent.AddingMembers:
        return (
          <AddChatMembers
            chatId={chatId!}
            onNextStep={handleAppendingChatMembers}
            isActive={isOpen && isActive}
            onClose={close}
          />
        );
      case RightColumnContent.ChatInfo:
      case RightColumnContent.UserInfo:
        return (
          <Profile
            key={currentProfileUserId || chatId!}
            chatId={chatId!}
            userId={currentProfileUserId}
            profileState={profileState}
            onProfileStateChange={setProfileState}
          />
        );
      case RightColumnContent.Search:
        return <RightSearch chatId={chatId!} threadId={threadId!} onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.Management:
        return (
          <Management
            chatId={chatId!}
            currentScreen={managementScreen}
            isPromotedByCurrentUser={isPromotedByCurrentUser}
            selectedChatMemberId={selectedChatMemberId}
            onScreenSelect={setManagementScreen}
            onChatMemberSelect={handleSelectChatMember}
            isActive={isOpen && isActive}
            onClose={close}
          />
        );

      case RightColumnContent.StickerSearch:
        return <StickerSearch onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.GifSearch:
        return <GifSearch onClose={close} isActive={isOpen && isActive} />;
      case RightColumnContent.PollResults:
        return <PollResults onClose={close} isActive={isOpen && isActive} />;
    }
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
          isColumnOpen={isOpen}
          isProfile={isProfile}
          isSearch={isSearch}
          isManagement={isManagement}
          isStickerSearch={isStickerSearch}
          isGifSearch={isGifSearch}
          isPollResults={isPollResults}
          isAddingChatMembers={isAddingChatMembers}
          profileState={profileState}
          managementScreen={managementScreen}
          onClose={close}
          shouldSkipAnimation={shouldSkipTransition || shouldSkipHistoryAnimations}
          onScreenSelect={setManagementScreen}
        />
        <Transition
          name={(shouldSkipTransition || shouldSkipHistoryAnimations) ? 'none' : 'zoom-fade'}
          renderCount={MAIN_SCREENS_COUNT + MANAGEMENT_SCREENS_COUNT}
          activeKey={isManagement ? MAIN_SCREENS_COUNT + managementScreen : renderingContentKey}
          shouldCleanup
          cleanupExceptionKey={RightColumnContent.ChatInfo}
        >
          {renderContent}
        </Transition>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const { chatId, threadId } = selectCurrentMessageList(global) || {};
    const areActiveChatsLoaded = selectAreActiveChatsLoaded(global);
    const nextManagementScreen = chatId ? global.management.byChatId[chatId]?.nextScreen : undefined;

    return {
      contentKey: selectRightColumnContentKey(global),
      chatId,
      threadId,
      currentProfileUserId: global.users.selectedId,
      isChatSelected: Boolean(chatId && areActiveChatsLoaded),
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      nextManagementScreen,
    };
  },
)(RightColumn));
