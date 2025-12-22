import type {
  ElementRef } from '@teact';
import {
  memo, useEffect, useMemo, useState,
} from '@teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type { FoldersActions } from '../../hooks/reducers/useFoldersReducer';
import type { ReducerAction } from '../../hooks/useReducer';
import { type AnimationLevel, LeftColumnContent, SettingsScreens } from '../../types';

import {
  selectCurrentChat, selectIsCurrentUserFrozen, selectIsForumPanelOpen, selectTabState,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import {
  IS_APP, IS_FIREFOX, IS_MAC_OS, IS_TOUCH_ENV,
} from '../../util/browser/windowEnvironment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { resolveTransitionName } from '../../util/resolveTransitionName';
import { captureControlledSwipe } from '../../util/swipeController';

import useFoldersReducer from '../../hooks/reducers/useFoldersReducer';
import { useHotkeys } from '../../hooks/useHotkeys';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import { useStateRef } from '../../hooks/useStateRef';
import useSyncEffect from '../../hooks/useSyncEffect';

import Transition from '../ui/Transition';
import ArchivedChats from './ArchivedChats.async';
import LeftMain from './main/LeftMain';
import NewChat from './newChat/NewChat.async';
import Settings from './settings/Settings.async';

import './LeftColumn.scss';

interface OwnProps {
  ref: ElementRef<HTMLDivElement>;
  isFoldersSidebarShown: boolean;
}

type StateProps = {
  contentKey: LeftColumnContent;
  settingsScreen: SettingsScreens;
  searchQuery?: string;
  searchDate?: number;
  isFirstChatFolderActive: boolean;
  animationLevel: AnimationLevel;
  shouldSkipHistoryAnimations?: boolean;
  currentUserId?: string;
  hasPasscode?: boolean;
  nextFoldersAction?: ReducerAction<FoldersActions>;
  isChatOpen: boolean;
  isAppUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  forumPanelChatId?: string;
  isClosingSearch?: boolean;
  archiveSettings: GlobalState['archiveSettings'];
  isArchivedStoryRibbonShown?: boolean;
  isAccountFrozen?: boolean;
};

enum ContentType {
  Main,

  // eslint-disable-next-line @typescript-eslint/no-shadow
  Settings,
  Archived,

  NewGroup,

  NewChannel,
}

const RENDER_COUNT = Object.keys(ContentType).length / 2;
const RESET_TRANSITION_DELAY_MS = 250;

function LeftColumn({
  ref,
  contentKey,
  settingsScreen,
  searchQuery,
  searchDate,
  isFirstChatFolderActive,
  animationLevel,
  shouldSkipHistoryAnimations,
  currentUserId,
  hasPasscode,
  nextFoldersAction,
  isChatOpen,
  isAppUpdateAvailable,
  isForumPanelOpen,
  forumPanelChatId,
  isClosingSearch,
  archiveSettings,
  isArchivedStoryRibbonShown,
  isAccountFrozen,
  isFoldersSidebarShown,
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
    openLeftColumnContent,
    openSettingsScreen,
  } = getActions();

  const [contactsFilter, setContactsFilter] = useState<string>('');
  const [foldersState, foldersDispatch] = useFoldersReducer();

  // Used to reset child components in background.
  const [lastResetTime, setLastResetTime] = useState<number>(0);

  let contentType: ContentType = ContentType.Main;
  switch (contentKey) {
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
      openLeftColumnContent({ contentKey: undefined });
      openSettingsScreen({ screen: undefined });
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

    if (contentKey === LeftColumnContent.NewGroupStep2) {
      openLeftColumnContent({ contentKey: LeftColumnContent.NewGroupStep1 });
      return;
    }

    if (contentKey === LeftColumnContent.NewChannelStep2) {
      openLeftColumnContent({ contentKey: LeftColumnContent.NewChannelStep1 });
      return;
    }

    if (contentKey === LeftColumnContent.NewGroupStep1) {
      const pickerSearchInput = document.getElementById('new-group-picker-search');
      if (pickerSearchInput) {
        pickerSearchInput.blur();
      }
    }

    if (contentKey === LeftColumnContent.Settings) {
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
          openSettingsScreen({ screen: SettingsScreens.Main });
          return;

        case SettingsScreens.GeneralChatBackground:
          openSettingsScreen({ screen: SettingsScreens.General });
          return;
        case SettingsScreens.GeneralChatBackgroundColor:
          openSettingsScreen({ screen: SettingsScreens.GeneralChatBackground });
          return;

        case SettingsScreens.PrivacyPhoneNumber:
        case SettingsScreens.PrivacyAddByPhone:
        case SettingsScreens.PrivacyLastSeen:
        case SettingsScreens.PrivacyProfilePhoto:
        case SettingsScreens.PrivacyBio:
        case SettingsScreens.PrivacyBirthday:
        case SettingsScreens.PrivacyGifts:
        case SettingsScreens.PrivacyPhoneCall:
        case SettingsScreens.PrivacyPhoneP2P:
        case SettingsScreens.PrivacyForwarding:
        case SettingsScreens.PrivacyGroupChats:
        case SettingsScreens.PrivacyVoiceMessages:
        case SettingsScreens.PrivacyMessages:
        case SettingsScreens.PrivacyBlockedUsers:
        case SettingsScreens.ActiveWebsites:
        case SettingsScreens.TwoFaDisabled:
        case SettingsScreens.TwoFaEnabled:
        case SettingsScreens.TwoFaCongratulations:
        case SettingsScreens.PasscodeDisabled:
        case SettingsScreens.PasscodeEnabled:
        case SettingsScreens.PasscodeCongratulations:
        case SettingsScreens.Passkeys:
          openSettingsScreen({ screen: SettingsScreens.Privacy });
          return;

        case SettingsScreens.PasscodeNewPasscode:
          openSettingsScreen({
            screen: hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled,
          });
          return;

        case SettingsScreens.PasscodeChangePasscodeCurrent:
        case SettingsScreens.PasscodeTurnOff:
          openSettingsScreen({ screen: SettingsScreens.PasscodeEnabled });
          return;

        case SettingsScreens.PasscodeNewPasscodeConfirm:
          openSettingsScreen({ screen: SettingsScreens.PasscodeNewPasscode });
          return;

        case SettingsScreens.PasscodeChangePasscodeNew:
          openSettingsScreen({ screen: SettingsScreens.PasscodeChangePasscodeCurrent });
          return;

        case SettingsScreens.PasscodeChangePasscodeConfirm:
          openSettingsScreen({ screen: SettingsScreens.PasscodeChangePasscodeNew });
          return;

        case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
        case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneNumber });
          return;
        case SettingsScreens.PrivacyLastSeenAllowedContacts:
        case SettingsScreens.PrivacyLastSeenDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyLastSeen });
          return;
        case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
        case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyProfilePhoto });
          return;
        case SettingsScreens.PrivacyBioAllowedContacts:
        case SettingsScreens.PrivacyBioDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyBio });
          return;
        case SettingsScreens.PrivacyBirthdayAllowedContacts:
        case SettingsScreens.PrivacyBirthdayDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyBirthday });
          return;
        case SettingsScreens.PrivacyGiftsAllowedContacts:
        case SettingsScreens.PrivacyGiftsDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyGifts });
          return;
        case SettingsScreens.PrivacyPhoneCallAllowedContacts:
        case SettingsScreens.PrivacyPhoneCallDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneCall });
          return;
        case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
        case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneP2P });
          return;
        case SettingsScreens.PrivacyForwardingAllowedContacts:
        case SettingsScreens.PrivacyForwardingDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyForwarding });
          return;
        case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
        case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyVoiceMessages });
          return;
        case SettingsScreens.PrivacyGroupChatsAllowedContacts:
        case SettingsScreens.PrivacyGroupChatsDeniedContacts:
          openSettingsScreen({ screen: SettingsScreens.PrivacyGroupChats });
          return;
        case SettingsScreens.TwoFaNewPassword:
          openSettingsScreen({ screen: SettingsScreens.TwoFaDisabled });
          return;
        case SettingsScreens.TwoFaNewPasswordConfirm:
          openSettingsScreen({ screen: SettingsScreens.TwoFaNewPassword });
          return;
        case SettingsScreens.TwoFaNewPasswordHint:
          openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordConfirm });
          return;
        case SettingsScreens.TwoFaNewPasswordEmail:
          openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordHint });
          return;
        case SettingsScreens.TwoFaNewPasswordEmailCode:
          openSettingsScreen({ screen: SettingsScreens.TwoFaNewPasswordEmail });
          return;
        case SettingsScreens.TwoFaChangePasswordCurrent:
        case SettingsScreens.TwoFaTurnOff:
        case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
          openSettingsScreen({ screen: SettingsScreens.TwoFaEnabled });
          return;
        case SettingsScreens.TwoFaChangePasswordNew:
          openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordCurrent });
          return;
        case SettingsScreens.TwoFaChangePasswordConfirm:
          openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordNew });
          return;
        case SettingsScreens.TwoFaChangePasswordHint:
          openSettingsScreen({ screen: SettingsScreens.TwoFaChangePasswordConfirm });
          return;
        case SettingsScreens.TwoFaRecoveryEmail:
          openSettingsScreen({ screen: SettingsScreens.TwoFaRecoveryEmailCurrentPassword });
          return;
        case SettingsScreens.TwoFaRecoveryEmailCode:
          openSettingsScreen({ screen: SettingsScreens.TwoFaRecoveryEmail });
          return;

        case SettingsScreens.FoldersCreateFolder:
        case SettingsScreens.FoldersEditFolder:
          openSettingsScreen({ screen: SettingsScreens.Folders });
          return;

        case SettingsScreens.FoldersShare:
          openSettingsScreen({ screen: SettingsScreens.FoldersEditFolder });
          return;

        case SettingsScreens.FoldersIncludedChatsFromChatList:
        case SettingsScreens.FoldersExcludedChatsFromChatList:
          openSettingsScreen({ screen: SettingsScreens.FoldersEditFolderFromChatList });
          return;

        case SettingsScreens.FoldersEditFolderFromChatList:
        case SettingsScreens.FoldersEditFolderInvites:
          openLeftColumnContent({ contentKey: LeftColumnContent.ChatList });
          openSettingsScreen({ screen: SettingsScreens.Main });
          return;

        case SettingsScreens.QuickReaction:
        case SettingsScreens.CustomEmoji:
          openSettingsScreen({ screen: SettingsScreens.Stickers });
          return;

        case SettingsScreens.DoNotTranslate:
          openSettingsScreen({ screen: SettingsScreens.Language });
          return;

        case SettingsScreens.PrivacyNoPaidMessages:
          openSettingsScreen({ screen: SettingsScreens.PrivacyMessages });
          return;

        default:
          break;
      }
    }

    if (contentKey === LeftColumnContent.ChatList && isFirstChatFolderActive) {
      openLeftColumnContent({ contentKey: LeftColumnContent.GlobalSearch });

      return;
    }

    fullReset();
  });

  const handleSearchQuery = useLastCallback((query: string) => {
    if (contentKey === LeftColumnContent.Contacts) {
      setContactsFilter(query);
      return;
    }

    openLeftColumnContent({ contentKey: LeftColumnContent.GlobalSearch });

    if (query !== searchQuery) {
      setGlobalSearchQuery({ query });
    }
  });

  const handleTopicSearch = useLastCallback(() => {
    openLeftColumnContent({ contentKey: LeftColumnContent.GlobalSearch });
    setGlobalSearchQuery({ query: '' });
    setGlobalSearchChatId({ id: forumPanelChatId });
  });

  useEffect(
    () => {
      const isArchived = contentKey === LeftColumnContent.Archived;
      const isChatList = contentKey === LeftColumnContent.ChatList;
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
    [isFirstChatFolderActive, contentKey, handleReset, isChatOpen, isForumPanelOpen],
  );

  const handleHotkeySearch = useLastCallback((e: KeyboardEvent) => {
    if (contentKey === LeftColumnContent.GlobalSearch) {
      return;
    }

    e.preventDefault();
    openLeftColumnContent({ contentKey: LeftColumnContent.GlobalSearch });
  });

  const handleHotkeySavedMessages = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    openChat({ id: currentUserId, shouldReplaceHistory: true });
  });

  const handleArchivedChats = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    openLeftColumnContent({ contentKey: LeftColumnContent.Archived });
  });

  const handleHotkeySettings = useLastCallback((e: KeyboardEvent) => {
    e.preventDefault();
    openLeftColumnContent({ contentKey: LeftColumnContent.Settings });
  });

  useHotkeys(useMemo(() => ({
    'Mod+Shift+F': handleHotkeySearch,
    // https://support.mozilla.org/en-US/kb/take-screenshots-firefox
    ...(!IS_FIREFOX && {
      'Mod+Shift+S': handleHotkeySavedMessages,
    }),
    ...(IS_APP && {
      'Mod+0': handleHotkeySavedMessages,
      'Mod+9': handleArchivedChats,
    }),
    ...(IS_MAC_OS && IS_APP && { 'Mod+,': handleHotkeySettings }),
  }), []));

  useEffect(() => {
    clearTwoFaError();

    if (settingsScreen === SettingsScreens.Privacy) {
      loadPasswordInfo();
    }
  }, [clearTwoFaError, loadPasswordInfo, settingsScreen]);

  useSyncEffect(() => {
    if (nextFoldersAction) {
      foldersDispatch(nextFoldersAction);
    }
  }, [foldersDispatch, nextFoldersAction]);

  const prevSettingsScreenRef = useStateRef(usePrevious(contentType === ContentType.Settings ? settingsScreen : -1));

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureControlledSwipe(ref.current!, {
      excludedClosestSelector: '.ProfileInfo, .color-picker, .hue-picker',
      selectorToPreventScroll: '#Settings .custom-scroll',
      onSwipeRightStart: handleReset,
      onCancel: () => {
        openLeftColumnContent({ contentKey: LeftColumnContent.Settings });
        openSettingsScreen({ screen: prevSettingsScreenRef.current! });
      },
    });
  }, [prevSettingsScreenRef, ref]);

  function renderContent(isActive: boolean) {
    switch (contentType) {
      case ContentType.Archived:
        return (
          <ArchivedChats
            isActive={isActive}
            onReset={handleReset}
            onTopicSearch={handleTopicSearch}
            foldersDispatch={foldersDispatch}
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
            animationLevel={animationLevel}
            shouldSkipTransition={shouldSkipHistoryAnimations}
            onReset={handleReset}
          />
        );
      case ContentType.NewChannel:
        return (
          <NewChat
            key={lastResetTime}
            isActive={isActive}
            isChannel
            content={contentKey}
            animationLevel={animationLevel}
            onReset={handleReset}
          />
        );
      case ContentType.NewGroup:
        return (
          <NewChat
            key={lastResetTime}
            isActive={isActive}
            content={contentKey}
            animationLevel={animationLevel}
            onReset={handleReset}
          />
        );
      default:
        return (
          <LeftMain
            content={contentKey}
            isClosingSearch={isClosingSearch}
            searchQuery={searchQuery}
            searchDate={searchDate}
            contactsFilter={contactsFilter}
            foldersDispatch={foldersDispatch}
            onSearchQuery={handleSearchQuery}
            onReset={handleReset}
            shouldSkipTransition={shouldSkipHistoryAnimations}
            isAppUpdateAvailable={isAppUpdateAvailable}
            isForumPanelOpen={isForumPanelOpen}
            onTopicSearch={handleTopicSearch}
            isAccountFrozen={isAccountFrozen}
            isFoldersSidebarShown={isFoldersSidebarShown}
          />
        );
    }
  }

  return (
    <Transition
      ref={ref}
      name={resolveTransitionName('layers', animationLevel, shouldSkipHistoryAnimations)}
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
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const {
      globalSearch: {
        query,
        minDate,
      },
      shouldSkipHistoryAnimations,
      activeChatFolder,
      leftColumn,
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
      archiveSettings,
    } = global;

    const { animationLevel } = selectSharedSettings(global);
    const currentChat = selectCurrentChat(global);
    const isChatOpen = Boolean(currentChat?.id);
    const isForumPanelOpen = selectIsForumPanelOpen(global);
    const forumPanelChatId = tabState.forumPanelChatId;
    const isAccountFrozen = selectIsCurrentUserFrozen(global);

    return {
      searchQuery: query,
      searchDate: minDate,
      isFirstChatFolderActive: activeChatFolder === 0,
      animationLevel,
      shouldSkipHistoryAnimations,
      currentUserId,
      hasPasscode,
      nextFoldersAction,
      isChatOpen,
      isAppUpdateAvailable,
      isForumPanelOpen,
      forumPanelChatId,
      isClosingSearch: tabState.globalSearch.isClosing,
      archiveSettings,
      isArchivedStoryRibbonShown: isArchivedRibbonShown,
      isAccountFrozen,
      contentKey: leftColumn.contentKey,
      settingsScreen: leftColumn.settingsScreen,
    };
  },
)(LeftColumn));
