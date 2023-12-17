import type { RefObject } from 'react';
import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { FoldersActions } from '../../hooks/reducers/useFoldersReducer';
import type { ReducerAction } from '../../hooks/useReducer';
import { LeftColumnContent, SettingsScreens } from '../../types';

import { selectCurrentChat, selectIsForumPanelOpen, selectTabState } from '../../global/selectors';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { captureControlledSwipe } from '../../util/swipeController';
import {
  IS_APP, IS_MAC_OS, IS_TOUCH_ENV, LAYERS_ANIMATION_NAME,
} from '../../util/windowEnvironment';

import useFoldersReducer from '../../hooks/reducers/useFoldersReducer';
import useElectronDrag from '../../hooks/useElectronDrag';
import { useHotkeys } from '../../hooks/useHotkeys';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious2 from '../../hooks/usePrevious2';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';

import Transition from '../ui/Transition';
import ArchivedChats from './ArchivedChats.async';
import LeftMain from './main/LeftMain';
import NewChat from './newChat/NewChat.async';
import Settings from './settings/Settings.async';
import UluInboxChats from './UluInboxChats';

import './LeftColumn.scss';

interface OwnProps {
  ref: RefObject<HTMLDivElement>;
  chatFoldersPortalRef: RefObject<HTMLDivElement>;
}

type StateProps = {
  searchQuery?: string;
  searchDate?: number;
  isFirstChatFolderActive: boolean;
  shouldSkipHistoryAnimations?: boolean;
  currentUserId?: string;
  currentChatId?: string;
  hasPasscode?: boolean;
  nextSettingsScreen?: SettingsScreens;
  nextFoldersAction?: ReducerAction<FoldersActions>;
  isChatOpen: boolean;
  isAppUpdateAvailable?: boolean;
  isElectronUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  forumPanelChatId?: string;
  isClosingSearch?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isArchivedStoryRibbonShown?: boolean;
};

enum ContentType {
  Main,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Settings,
  Archived,
  // eslint-disable-next-line no-shadow
  NewGroup,
  // eslint-disable-next-line no-shadow
  NewChannel,
  UluInbox,
}

const RENDER_COUNT = Object.keys(ContentType).length / 2;
const RESET_TRANSITION_DELAY_MS = 250;

function LeftColumn({
  ref,
  searchQuery,
  searchDate,
  isFirstChatFolderActive,
  shouldSkipHistoryAnimations,
  currentUserId,
  currentChatId,
  hasPasscode,
  nextSettingsScreen,
  nextFoldersAction,
  isChatOpen,
  isAppUpdateAvailable,
  isElectronUpdateAvailable,
  isForumPanelOpen,
  forumPanelChatId,
  isClosingSearch,
  archiveSettings,
  isArchivedStoryRibbonShown,
  chatFoldersPortalRef,
}: OwnProps & StateProps) {
  const {
    setGlobalSearchQuery,
    setGlobalSearchClosing,
    setGlobalSearchChatId,
    resetChatCreation,
    setGlobalSearchDate,
    loadPasswordInfo,
    clearTwoFaError,
    openChat,
    requestNextSettingsScreen,
  } = getActions();

  const [content, setContent] = useState<LeftColumnContent>(LeftColumnContent.ChatList);
  const [settingsScreen, setSettingsScreen] = useState(SettingsScreens.Main);
  const [contactsFilter, setContactsFilter] = useState<string>('');
  const [foldersState, foldersDispatch] = useFoldersReducer();

  // Used to reset child components in background.
  const [lastResetTime, setLastResetTime] = useState<number>(0);

  let contentType: ContentType = ContentType.Main;
  switch (content) {
    case LeftColumnContent.UluInbox:
      contentType = ContentType.UluInbox;
      break;
    case LeftColumnContent.Archived:
      contentType = ContentType.Archived;
      break;
    case LeftColumnContent.Settings:
      contentType = ContentType.Settings;
      break;
    case LeftColumnContent.NewChannelStep1:
    case LeftColumnContent.NewChannelStep2:
      contentType = ContentType.NewChannel;
      break;
    case LeftColumnContent.NewGroupStep1:
    case LeftColumnContent.NewGroupStep2:
      contentType = ContentType.NewGroup;
      break;
  }

  const handleReset = useLastCallback((forceReturnToChatList?: true | Event) => {
    function fullReset() {
      setContent(LeftColumnContent.ChatList);
      setSettingsScreen(SettingsScreens.Main);
      setContactsFilter('');
      setGlobalSearchClosing({ isClosing: true });
      resetChatCreation();
      setTimeout(() => {
        setGlobalSearchQuery({ query: '' });
        setGlobalSearchDate({ date: undefined });
        setGlobalSearchChatId({ id: undefined });
        setGlobalSearchClosing({ isClosing: false });
        setLastResetTime(Date.now());
      }, RESET_TRANSITION_DELAY_MS);
    }

    if (forceReturnToChatList === true) {
      fullReset();
      return;
    }

    if (content === LeftColumnContent.NewGroupStep2) {
      setContent(LeftColumnContent.NewGroupStep1);
      return;
    }

    if (content === LeftColumnContent.NewChannelStep2) {
      setContent(LeftColumnContent.NewChannelStep1);
      return;
    }

    if (content === LeftColumnContent.NewGroupStep1) {
      const pickerSearchInput = document.getElementById('new-group-picker-search');
      if (pickerSearchInput) {
        pickerSearchInput.blur();
      }
    }

    if (content === LeftColumnContent.Settings) {
      switch (settingsScreen) {
        case SettingsScreens.EditProfile:
        case SettingsScreens.Folders:
        case SettingsScreens.General:
        case SettingsScreens.Notifications:
        case SettingsScreens.DataStorage:
        case SettingsScreens.Privacy:
        case SettingsScreens.Performance:
        case SettingsScreens.ActiveSessions:
        case SettingsScreens.Language:
        case SettingsScreens.Stickers:
        case SettingsScreens.Experimental:
          setSettingsScreen(SettingsScreens.Main);
          return;

        case SettingsScreens.GeneralChatBackground:
          setSettingsScreen(SettingsScreens.General);
          return;
        case SettingsScreens.GeneralChatBackgroundColor:
          setSettingsScreen(SettingsScreens.GeneralChatBackground);
          return;

        case SettingsScreens.PrivacyPhoneNumber:
        case SettingsScreens.PrivacyAddByPhone:
        case SettingsScreens.PrivacyLastSeen:
        case SettingsScreens.PrivacyProfilePhoto:
        case SettingsScreens.PrivacyBio:
        case SettingsScreens.PrivacyPhoneCall:
        case SettingsScreens.PrivacyPhoneP2P:
        case SettingsScreens.PrivacyForwarding:
        case SettingsScreens.PrivacyGroupChats:
        case SettingsScreens.PrivacyVoiceMessages:
        case SettingsScreens.PrivacyBlockedUsers:
        case SettingsScreens.ActiveWebsites:
        case SettingsScreens.TwoFaDisabled:
        case SettingsScreens.TwoFaEnabled:
        case SettingsScreens.TwoFaCongratulations:
        case SettingsScreens.PasscodeDisabled:
        case SettingsScreens.PasscodeEnabled:
        case SettingsScreens.PasscodeCongratulations:
          setSettingsScreen(SettingsScreens.Privacy);
          return;

        case SettingsScreens.PasscodeNewPasscode:
          setSettingsScreen(hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled);
          return;

        case SettingsScreens.PasscodeChangePasscodeCurrent:
        case SettingsScreens.PasscodeTurnOff:
          setSettingsScreen(SettingsScreens.PasscodeEnabled);
          return;

        case SettingsScreens.PasscodeNewPasscodeConfirm:
          setSettingsScreen(SettingsScreens.PasscodeNewPasscode);
          return;

        case SettingsScreens.PasscodeChangePasscodeNew:
          setSettingsScreen(SettingsScreens.PasscodeChangePasscodeCurrent);
          return;

        case SettingsScreens.PasscodeChangePasscodeConfirm:
          setSettingsScreen(SettingsScreens.PasscodeChangePasscodeNew);
          return;

        case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
        case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyPhoneNumber);
          return;
        case SettingsScreens.PrivacyLastSeenAllowedContacts:
        case SettingsScreens.PrivacyLastSeenDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyLastSeen);
          return;
        case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
        case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyProfilePhoto);
          return;
        case SettingsScreens.PrivacyBioAllowedContacts:
        case SettingsScreens.PrivacyBioDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyBio);
          return;
        case SettingsScreens.PrivacyPhoneCallAllowedContacts:
        case SettingsScreens.PrivacyPhoneCallDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyPhoneCall);
          return;
        case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
        case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyPhoneP2P);
          return;
        case SettingsScreens.PrivacyForwardingAllowedContacts:
        case SettingsScreens.PrivacyForwardingDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyForwarding);
          return;
        case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
        case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyVoiceMessages);
          return;
        case SettingsScreens.PrivacyGroupChatsAllowedContacts:
        case SettingsScreens.PrivacyGroupChatsDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyGroupChats);
          return;
        case SettingsScreens.TwoFaNewPassword:
          setSettingsScreen(SettingsScreens.TwoFaDisabled);
          return;
        case SettingsScreens.TwoFaNewPasswordConfirm:
          setSettingsScreen(SettingsScreens.TwoFaNewPassword);
          return;
        case SettingsScreens.TwoFaNewPasswordHint:
          setSettingsScreen(SettingsScreens.TwoFaNewPasswordConfirm);
          return;
        case SettingsScreens.TwoFaNewPasswordEmail:
          setSettingsScreen(SettingsScreens.TwoFaNewPasswordHint);
          return;
        case SettingsScreens.TwoFaNewPasswordEmailCode:
          setSettingsScreen(SettingsScreens.TwoFaNewPasswordEmail);
          return;
        case SettingsScreens.TwoFaChangePasswordCurrent:
        case SettingsScreens.TwoFaTurnOff:
        case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
          setSettingsScreen(SettingsScreens.TwoFaEnabled);
          return;
        case SettingsScreens.TwoFaChangePasswordNew:
          setSettingsScreen(SettingsScreens.TwoFaChangePasswordCurrent);
          return;
        case SettingsScreens.TwoFaChangePasswordConfirm:
          setSettingsScreen(SettingsScreens.TwoFaChangePasswordNew);
          return;
        case SettingsScreens.TwoFaChangePasswordHint:
          setSettingsScreen(SettingsScreens.TwoFaChangePasswordConfirm);
          return;
        case SettingsScreens.TwoFaRecoveryEmail:
          setSettingsScreen(SettingsScreens.TwoFaRecoveryEmailCurrentPassword);
          return;
        case SettingsScreens.TwoFaRecoveryEmailCode:
          setSettingsScreen(SettingsScreens.TwoFaRecoveryEmail);
          return;

        case SettingsScreens.FoldersCreateFolder:
        case SettingsScreens.FoldersEditFolder:
          setSettingsScreen(SettingsScreens.Folders);
          return;

        case SettingsScreens.FoldersShare:
          setSettingsScreen(SettingsScreens.FoldersEditFolder);
          return;

        case SettingsScreens.FoldersIncludedChatsFromChatList:
        case SettingsScreens.FoldersExcludedChatsFromChatList:
          setSettingsScreen(SettingsScreens.FoldersEditFolderFromChatList);
          return;

        case SettingsScreens.FoldersEditFolderFromChatList:
        case SettingsScreens.FoldersEditFolderInvites:
          setContent(LeftColumnContent.ChatList);
          setSettingsScreen(SettingsScreens.Main);
          return;

        case SettingsScreens.QuickReaction:
        case SettingsScreens.CustomEmoji:
          setSettingsScreen(SettingsScreens.Stickers);
          return;

        case SettingsScreens.DoNotTranslate:
          setSettingsScreen(SettingsScreens.Language);
          return;
        default:
          break;
      }
    }

    if (content === LeftColumnContent.ChatList && isFirstChatFolderActive) {
      setContent(LeftColumnContent.GlobalSearch);

      return;
    }

    fullReset();
  });

  const handleSearchQuery = useLastCallback((query: string) => {
    if (content === LeftColumnContent.Contacts) {
      setContactsFilter(query);
      return;
    }

    setContent(LeftColumnContent.GlobalSearch);

    if (query !== searchQuery) {
      setGlobalSearchQuery({ query });
    }
  });

  const handleTopicSearch = useLastCallback(() => {
    setContent(LeftColumnContent.GlobalSearch);
    setGlobalSearchQuery({ query: '' });
    setGlobalSearchChatId({ id: forumPanelChatId });
  });

  useEffect(
    () => {
      const isArchived = content === LeftColumnContent.Archived;
      const isChatList = content === LeftColumnContent.ChatList;
      const noChatOrForumOpen = !isChatOpen && !isForumPanelOpen;
      // We listen for escape key only in these cases:
      // 1. When we are in archived chats and no chat or forum is open.
      // 2. When we are in any other screen except chat list and archived chat list.
      // 3. When we are in chat list and first chat folder is active and no chat or forum is open.
      if ((isArchived && noChatOrForumOpen) || (!isChatList && !isArchived)
        || (isFirstChatFolderActive && noChatOrForumOpen)) {
        return captureEscKeyListener(() => {
          handleReset();
        });
      } else {
        return undefined;
      }
    },
    [isFirstChatFolderActive, content, handleReset, isChatOpen, isForumPanelOpen],
  );

  const handleHotkeySearch = useLastCallback((e: KeyboardEvent) => {
    if (content === LeftColumnContent.GlobalSearch) {
      return;
    }

    e.preventDefault();
    setContent(LeftColumnContent.GlobalSearch);
  });

  const handleHotkeySavedMessages = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleArchivedChats = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    setContent(LeftColumnContent.Archived);
  });

  const handleHotkeySettings = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    setContent(LeftColumnContent.Settings);
  });

  useHotkeys({
    'Mod+Shift+F': handleHotkeySearch,
    'Mod+Shift+S': handleHotkeySavedMessages,
    ...(IS_APP && {
      'Mod+0': handleHotkeySavedMessages,
      'Mod+9': handleArchivedChats,
    }),
    ...(IS_MAC_OS && IS_APP && { 'Mod+,': handleHotkeySettings }),
  });

  useEffect(() => {
    clearTwoFaError();

    if (settingsScreen === SettingsScreens.Privacy) {
      loadPasswordInfo();
    }
  }, [clearTwoFaError, loadPasswordInfo, settingsScreen]);

  useSyncEffect(() => {
    if (nextSettingsScreen !== undefined) {
      setContent(LeftColumnContent.Settings);
      setSettingsScreen(nextSettingsScreen);
      requestNextSettingsScreen({ screen: undefined });
    }

    if (nextFoldersAction) {
      foldersDispatch(nextFoldersAction);
    }
  }, [foldersDispatch, nextFoldersAction, nextSettingsScreen, requestNextSettingsScreen]);

  const handleSettingsScreenSelect = useLastCallback((screen: SettingsScreens) => {
    setContent(LeftColumnContent.Settings);
    setSettingsScreen(screen);
  });

  const prevSettingsScreenRef = useStateRef(usePrevious2(contentType === ContentType.Settings ? settingsScreen : -1));

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureControlledSwipe(ref.current!, {
      excludedClosestSelector: '.ProfileInfo, .color-picker, .hue-picker',
      selectorToPreventScroll: '#Settings .custom-scroll',
      onSwipeRightStart: handleReset,
      onCancel: () => {
        setContent(LeftColumnContent.Settings);
        handleSettingsScreenSelect(prevSettingsScreenRef.current!);
      },
    });
  }, [prevSettingsScreenRef, ref]);

  function renderContent(isActive: boolean) {
    switch (contentType) {
      case ContentType.UluInbox:
        return (
          <UluInboxChats
            isActive={isActive}
            onReset={handleReset}
            onTopicSearch={handleTopicSearch}
            foldersDispatch={foldersDispatch}
            onSettingsScreenSelect={handleSettingsScreenSelect}
            onLeftColumnContentChange={setContent}
            isForumPanelOpen={isForumPanelOpen}
            archiveSettings={archiveSettings}
            isStoryRibbonShown={isArchivedStoryRibbonShown}
          />
        );
      case ContentType.Archived:
        return (
          <ArchivedChats
            isActive={isActive}
            onReset={handleReset}
            onTopicSearch={handleTopicSearch}
            foldersDispatch={foldersDispatch}
            onSettingsScreenSelect={handleSettingsScreenSelect}
            onLeftColumnContentChange={setContent}
            isForumPanelOpen={isForumPanelOpen}
            archiveSettings={archiveSettings}
            isStoryRibbonShown={isArchivedStoryRibbonShown}
          />
        );
      case ContentType.Settings:
        return (
          <Settings
            isActive={isActive}
            currentScreen={settingsScreen}
            foldersState={foldersState}
            foldersDispatch={foldersDispatch}
            shouldSkipTransition={shouldSkipHistoryAnimations}
            onScreenSelect={handleSettingsScreenSelect}
            onReset={handleReset}
          />
        );
      case ContentType.NewChannel:
        return (
          <NewChat
            key={lastResetTime}
            isActive={isActive}
            isChannel
            content={content}
            onContentChange={setContent}
            onReset={handleReset}
          />
        );
      case ContentType.NewGroup:
        return (
          <NewChat
            key={lastResetTime}
            isActive={isActive}
            content={content}
            onContentChange={setContent}
            onReset={handleReset}
          />
        );
      default:
        return (
          <LeftMain
            chatFoldersPortalRef={chatFoldersPortalRef}
            content={content}
            chatId={currentChatId}
            userId={currentUserId}
            isClosingSearch={isClosingSearch}
            searchQuery={searchQuery}
            searchDate={searchDate}
            contactsFilter={contactsFilter}
            foldersDispatch={foldersDispatch}
            onContentChange={setContent}
            onSearchQuery={handleSearchQuery}
            onSettingsScreenSelect={handleSettingsScreenSelect}
            onReset={handleReset}
            shouldSkipTransition={shouldSkipHistoryAnimations}
            isAppUpdateAvailable={isAppUpdateAvailable}
            isElectronUpdateAvailable={isElectronUpdateAvailable}
            isForumPanelOpen={isForumPanelOpen}
            onTopicSearch={handleTopicSearch}
          />
        );
    }
  }

  // eslint-disable-next-line no-null/no-null
  const LeftBackground = useRef<HTMLDivElement>(null);
  useElectronDrag(LeftBackground);

  return (
    <div className="LeftBackground" ref={LeftBackground}>
      <Transition
        ref={ref}
        name={shouldSkipHistoryAnimations ? 'none' : LAYERS_ANIMATION_NAME}
        renderCount={RENDER_COUNT}
        activeKey={contentType}
        shouldCleanup
        cleanupExceptionKey={ContentType.Main}
        shouldWrap
        wrapExceptionKey={ContentType.Main}
        id="LeftColumn"
        withSwipeControl
      >
        {renderContent}
      </Transition>
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const tabState = selectTabState(global);
    const {
      globalSearch: {
        query,
        date,
      },
      shouldSkipHistoryAnimations,
      activeChatFolder,
      nextSettingsScreen,
      nextFoldersAction,
      storyViewer: {
        isArchivedRibbonShown,
      },
    } = tabState;
    const {
      currentUserId,
      passcode: {
        hasPasscode,
      },
      isAppUpdateAvailable,
      isElectronUpdateAvailable,
      archiveSettings,
    } = global;

    const currentChat = selectCurrentChat(global);
    const isChatOpen = Boolean(currentChat?.id);
    const isForumPanelOpen = selectIsForumPanelOpen(global);
    const forumPanelChatId = tabState.forumPanelChatId;

    return {
      searchQuery: query,
      searchDate: date,
      isFirstChatFolderActive: activeChatFolder === 0,
      shouldSkipHistoryAnimations,
      currentUserId,
      currentChatId: currentChat?.id,
      hasPasscode,
      nextSettingsScreen,
      nextFoldersAction,
      isChatOpen,
      isAppUpdateAvailable,
      isElectronUpdateAvailable,
      isForumPanelOpen,
      forumPanelChatId,
      isClosingSearch: tabState.globalSearch.isClosing,
      archiveSettings,
      isArchivedStoryRibbonShown: isArchivedRibbonShown,
    };
  },
)(LeftColumn));
