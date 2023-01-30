import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { LeftColumnContent, SettingsScreens } from '../../types';

import { IS_MAC_OS, IS_PWA, LAYERS_ANIMATION_NAME } from '../../util/environment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { selectTabState, selectCurrentChat, selectIsForumPanelOpen } from '../../global/selectors';
import useFoldersReducer from '../../hooks/reducers/useFoldersReducer';
import { useResize } from '../../hooks/useResize';
import { useHotkeys } from '../../hooks/useHotkeys';
import useOnChange from '../../hooks/useOnChange';

import Transition from '../ui/Transition';
import LeftMain from './main/LeftMain';
import Settings from './settings/Settings.async';
import NewChat from './newChat/NewChat.async';
import ArchivedChats from './ArchivedChats.async';

import './LeftColumn.scss';

type StateProps = {
  searchQuery?: string;
  searchDate?: number;
  isFirstChatFolderActive: boolean;
  shouldSkipHistoryAnimations?: boolean;
  leftColumnWidth?: number;
  currentUserId?: string;
  hasPasscode?: boolean;
  nextSettingsScreen?: SettingsScreens;
  isChatOpen: boolean;
  isUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  forumPanelChatId?: string;
  isClosingSearch?: boolean;
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
}

const RENDER_COUNT = Object.keys(ContentType).length / 2;
const RESET_TRANSITION_DELAY_MS = 250;

const LeftColumn: FC<StateProps> = ({
  searchQuery,
  searchDate,
  isFirstChatFolderActive,
  shouldSkipHistoryAnimations,
  leftColumnWidth,
  currentUserId,
  hasPasscode,
  nextSettingsScreen,
  isChatOpen,
  isUpdateAvailable,
  isForumPanelOpen,
  forumPanelChatId,
  isClosingSearch,
}) => {
  const {
    setGlobalSearchQuery,
    setGlobalSearchClosing,
    setGlobalSearchChatId,
    resetChatCreation,
    setGlobalSearchDate,
    loadPasswordInfo,
    clearTwoFaError,
    setLeftColumnWidth,
    resetLeftColumnWidth,
    openChat,
    requestNextSettingsScreen,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const resizeRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<LeftColumnContent>(LeftColumnContent.ChatList);
  const [settingsScreen, setSettingsScreen] = useState(SettingsScreens.Main);
  const [contactsFilter, setContactsFilter] = useState<string>('');
  const [foldersState, foldersDispatch] = useFoldersReducer();

  // Used to reset child components in background.
  const [lastResetTime, setLastResetTime] = useState<number>(0);

  let contentType: ContentType = ContentType.Main;
  switch (content) {
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

  const handleReset = useCallback((forceReturnToChatList?: true | Event) => {
    function fullReset() {
      setContent(LeftColumnContent.ChatList);
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
        case SettingsScreens.PrivacyLastSeen:
        case SettingsScreens.PrivacyProfilePhoto:
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

        case SettingsScreens.FoldersIncludedChatsFromChatList:
        case SettingsScreens.FoldersExcludedChatsFromChatList:
          setSettingsScreen(SettingsScreens.FoldersEditFolderFromChatList);
          return;

        case SettingsScreens.FoldersEditFolderFromChatList:
          setContent(LeftColumnContent.ChatList);
          setSettingsScreen(SettingsScreens.Main);
          return;

        case SettingsScreens.QuickReaction:
        case SettingsScreens.CustomEmoji:
          setSettingsScreen(SettingsScreens.Stickers);
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
  }, [
    content, isFirstChatFolderActive, setGlobalSearchClosing, resetChatCreation, setGlobalSearchQuery,
    setGlobalSearchDate, setGlobalSearchChatId, settingsScreen, hasPasscode,
  ]);

  const handleSearchQuery = useCallback((query: string) => {
    if (content === LeftColumnContent.Contacts) {
      setContactsFilter(query);
      return;
    }

    setContent(LeftColumnContent.GlobalSearch);

    if (query !== searchQuery) {
      setGlobalSearchQuery({ query });
    }
  }, [content, searchQuery, setGlobalSearchQuery]);

  const handleTopicSearch = useCallback(() => {
    setContent(LeftColumnContent.GlobalSearch);
    setGlobalSearchQuery({ query: '' });
    setGlobalSearchChatId({ id: forumPanelChatId });
  }, [forumPanelChatId, setGlobalSearchChatId, setGlobalSearchQuery]);

  useEffect(
    () => (content !== LeftColumnContent.ChatList || (isFirstChatFolderActive && !isChatOpen && !isForumPanelOpen)
      ? captureEscKeyListener(() => handleReset())
      : undefined),
    [isFirstChatFolderActive, content, handleReset, isChatOpen, isForumPanelOpen],
  );

  const handleHotkeySearch = useCallback((e: KeyboardEvent) => {
    if (content === LeftColumnContent.GlobalSearch) {
      return;
    }

    e.preventDefault();
    setContent(LeftColumnContent.GlobalSearch);
  }, [content]);

  const handleHotkeySavedMessages = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  }, [currentUserId, openChat]);

  const handleHotkeySettings = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    setContent(LeftColumnContent.Settings);
  }, []);

  useHotkeys({
    'Mod+Shift+F': handleHotkeySearch,
    'Mod+Shift+S': handleHotkeySavedMessages,
    'Mod+0': handleHotkeySavedMessages,
    ...(IS_MAC_OS && IS_PWA && { 'Mod+,': handleHotkeySettings }),
  });

  useEffect(() => {
    clearTwoFaError();

    if (settingsScreen === SettingsScreens.Privacy) {
      loadPasswordInfo();
    }
  }, [clearTwoFaError, loadPasswordInfo, settingsScreen]);

  useOnChange(() => {
    if (nextSettingsScreen !== undefined) {
      setContent(LeftColumnContent.Settings);
      setSettingsScreen(nextSettingsScreen);
      requestNextSettingsScreen({ screen: undefined });
    }
  }, [nextSettingsScreen, requestNextSettingsScreen]);

  const {
    initResize, resetResize, handleMouseUp,
  } = useResize(resizeRef, (n) => setLeftColumnWidth({
    leftColumnWidth: n,
  }), resetLeftColumnWidth, leftColumnWidth, '--left-column-width');

  const handleSettingsScreenSelect = useCallback((screen: SettingsScreens) => {
    setContent(LeftColumnContent.Settings);
    setSettingsScreen(screen);
  }, []);

  return (
    <div
      id="LeftColumn"
      ref={resizeRef}
    >
      <Transition
        name={shouldSkipHistoryAnimations ? 'none' : LAYERS_ANIMATION_NAME}
        renderCount={RENDER_COUNT}
        activeKey={contentType}
        shouldCleanup
        cleanupExceptionKey={ContentType.Main}
      >
        {(isActive) => {
          switch (contentType) {
            case ContentType.Archived:
              return (
                <ArchivedChats
                  isActive={isActive}
                  onReset={handleReset}
                  onTopicSearch={handleTopicSearch}
                  isForumPanelOpen={isForumPanelOpen}
                />
              );
            case ContentType.Settings:
              return (
                <Settings
                  isActive={isActive}
                  currentScreen={settingsScreen}
                  foldersState={foldersState}
                  foldersDispatch={foldersDispatch}
                  onScreenSelect={handleSettingsScreenSelect}
                  onReset={handleReset}
                  shouldSkipTransition={shouldSkipHistoryAnimations}
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
                  content={content}
                  isClosingSearch={isClosingSearch}
                  searchQuery={searchQuery}
                  searchDate={searchDate}
                  contactsFilter={contactsFilter}
                  foldersDispatch={foldersDispatch}
                  onContentChange={setContent}
                  onSearchQuery={handleSearchQuery}
                  onScreenSelect={handleSettingsScreenSelect}
                  onReset={handleReset}
                  shouldSkipTransition={shouldSkipHistoryAnimations}
                  isUpdateAvailable={isUpdateAvailable}
                  isForumPanelOpen={isForumPanelOpen}
                  onTopicSearch={handleTopicSearch}
                />
              );
          }
        }}
      </Transition>
      <div
        className="resize-handle"
        onMouseDown={initResize}
        onMouseUp={handleMouseUp}
        onDoubleClick={resetResize}
      />
    </div>
  );
};

export default memo(withGlobal(
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
    } = tabState;
    const {
      leftColumnWidth,
      currentUserId,
      passcode: {
        hasPasscode,
      },
      isUpdateAvailable,
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
      leftColumnWidth,
      currentUserId,
      hasPasscode,
      nextSettingsScreen,
      isChatOpen,
      isUpdateAvailable,
      isForumPanelOpen,
      forumPanelChatId,
      isClosingSearch: tabState.globalSearch.isClosing,
    };
  },
)(LeftColumn));
