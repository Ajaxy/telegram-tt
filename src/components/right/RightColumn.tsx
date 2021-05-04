import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ManagementScreens, ProfileState, RightColumnContent } from '../../types';

import { MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN } from '../../config';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { pick } from '../../util/iteratees';
import {
  selectAreActiveChatsLoaded,
  selectCurrentMessageList,
  selectRightColumnContentKey,
} from '../../modules/selectors';
import useLayoutEffectWithPrevDeps from '../../hooks/useLayoutEffectWithPrevDeps';
import useWindowSize from '../../hooks/useWindowSize';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import RightHeader from './RightHeader';
import Profile from './Profile';
import Transition from '../ui/Transition';
import RightSearch from './RightSearch.async';
import Management from './management/Management.async';
import StickerSearch from './StickerSearch.async';
import GifSearch from './GifSearch.async';
import PollResults from './PollResults.async';

import './RightColumn.scss';

type StateProps = {
  contentKey?: RightColumnContent;
  chatId?: number;
  threadId?: number;
  currentProfileUserId?: number;
  isChatSelected: boolean;
};

type DispatchProps = Pick<GlobalActions, (
  'toggleChatInfo' | 'toggleManagement' | 'openUserInfo' |
  'closeLocalTextSearch' | 'closePollResults' |
  'setStickerSearchQuery' | 'setGifSearchQuery'
)>;

const COLUMN_CLOSE_DELAY_MS = 300;
const MAIN_SCREENS_COUNT = Object.keys(RightColumnContent).length / 2;
const MANAGEMENT_SCREENS_COUNT = Object.keys(ManagementScreens).length / 2;

function blurSearchInput() {
  const searchInput = document.querySelector('.RightHeader .SearchInput input') as HTMLInputElement;
  if (searchInput) {
    searchInput.blur();
  }
}

const RightColumn: FC<StateProps & DispatchProps> = ({
  contentKey,
  chatId,
  threadId,
  currentProfileUserId,
  isChatSelected,
  toggleChatInfo,
  toggleManagement,
  openUserInfo,
  closeLocalTextSearch,
  setStickerSearchQuery,
  setGifSearchQuery,
  closePollResults,
}) => {
  const { width: windowWidth } = useWindowSize();
  const [profileState, setProfileState] = useState<ProfileState>(ProfileState.Profile);
  const [managementScreen, setManagementScreen] = useState<ManagementScreens>(ManagementScreens.Initial);
  const [selectedChatMemberId, setSelectedChatMemberId] = useState<number | undefined>();
  const [isPromotedByCurrentUser, setIsPromotedByCurrentUser] = useState<boolean | undefined>();
  const isScrolledDown = profileState !== ProfileState.Profile;

  const isOpen = contentKey !== undefined;
  const isProfile = contentKey === RightColumnContent.ChatInfo || contentKey === RightColumnContent.UserInfo;
  const isSearch = contentKey === RightColumnContent.Search;
  const isManagement = contentKey === RightColumnContent.Management;
  const isStickerSearch = contentKey === RightColumnContent.StickerSearch;
  const isGifSearch = contentKey === RightColumnContent.GifSearch;
  const isPollResults = contentKey === RightColumnContent.PollResults;
  const isOverlaying = windowWidth <= MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN;

  const [shouldSkipTransition, setShouldSkipTransition] = useState(!isOpen);

  const renderingContentKey = useCurrentOrPrev(contentKey, true, !isChatSelected) ?? -1;

  const close = useCallback(() => {
    switch (contentKey) {
      case RightColumnContent.ChatInfo:
        if (isScrolledDown) {
          setProfileState(ProfileState.Profile);
          break;
        }
        toggleChatInfo();
        break;
      case RightColumnContent.UserInfo:
        if (isScrolledDown) {
          setProfileState(ProfileState.Profile);
          break;
        }
        openUserInfo({ id: undefined });
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
          case ManagementScreens.GroupRecentActions:
            setManagementScreen(ManagementScreens.ChatAdministrators);
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
      case RightColumnContent.GifSearch: {
        blurSearchInput();
        setStickerSearchQuery({ query: undefined });
        setGifSearchQuery({ query: undefined });
        break;
      }
      case RightColumnContent.PollResults:
        closePollResults();
        break;
    }
  }, [
    contentKey, isScrolledDown, toggleChatInfo, openUserInfo, closePollResults,
    managementScreen, toggleManagement, closeLocalTextSearch, setStickerSearchQuery, setGifSearchQuery,
  ]);

  const handleSelectChatMember = useCallback((memberId, isPromoted) => {
    setSelectedChatMemberId(memberId);
    setIsPromotedByCurrentUser(isPromoted);
  }, []);

  useEffect(() => (isOpen ? captureEscKeyListener(close) : undefined), [isOpen, close]);

  useEffect(() => {
    setTimeout(() => {
      setShouldSkipTransition(!isOpen);
    }, COLUMN_CLOSE_DELAY_MS);
  }, [isOpen]);

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

  // eslint-disable-next-line consistent-return
  function renderContent() {
    if (renderingContentKey === -1) {
      return undefined;
    }

    switch (renderingContentKey) {
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
        return <RightSearch chatId={chatId!} threadId={threadId!} />;
      case RightColumnContent.Management:
        return (
          <Management
            chatId={chatId!}
            currentScreen={managementScreen}
            isPromotedByCurrentUser={isPromotedByCurrentUser}
            selectedChatMemberId={selectedChatMemberId}
            onScreenSelect={setManagementScreen}
            onChatMemberSelect={handleSelectChatMember}
          />
        );
      case RightColumnContent.StickerSearch:
        return <StickerSearch />;
      case RightColumnContent.GifSearch:
        return <GifSearch />;
      case RightColumnContent.PollResults:
        return <PollResults />;
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
          profileState={profileState}
          managementScreen={managementScreen}
          onClose={close}
        />
        <Transition
          name={shouldSkipTransition ? 'none' : 'zoom-fade'}
          renderCount={MAIN_SCREENS_COUNT + MANAGEMENT_SCREENS_COUNT}
          activeKey={isManagement ? MAIN_SCREENS_COUNT + managementScreen : renderingContentKey}
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

    return {
      contentKey: selectRightColumnContentKey(global),
      chatId,
      threadId,
      currentProfileUserId: global.users.selectedId,
      isChatSelected: Boolean(chatId && areActiveChatsLoaded),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'openUserInfo',
    'toggleChatInfo',
    'toggleManagement',
    'closeLocalTextSearch',
    'setStickerSearchQuery',
    'setGifSearchQuery',
    'closePollResults',
  ]),
)(RightColumn));
