import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { LeftColumnContent, SettingsScreens } from '../../types';

import useHistoryBack from '../../hooks/useHistoryBack';
import useFlag from '../../hooks/useFlag';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { pick } from '../../util/iteratees';

import Transition, { ANIMATION_DURATION } from '../ui/Transition';
import LeftMain from './main/LeftMain';
import Settings from './settings/Settings.async';
import NewChat from './newChat/NewChat.async';
import ArchivedChats from './ArchivedChats.async';
import { HistoryWrapper } from '../../util/history';

import './LeftColumn.scss';

type StateProps = {
  searchQuery?: string;
  searchDate?: number;
  activeChatFolder: number;
};

type DispatchProps = Pick<GlobalActions, (
  'setGlobalSearchQuery' | 'setGlobalSearchChatId' | 'resetChatCreation' | 'setGlobalSearchDate' |
  'loadPasswordInfo' | 'clearTwoFaError'
)>;

enum ContentType {
  Main,
  // eslint-disable-next-line no-shadow
  Settings,
  Archived,
  // eslint-disable-next-line no-shadow
  NewGroup,
  // eslint-disable-next-line no-shadow
  NewChannel
}

const RENDER_COUNT = Object.keys(ContentType).length / 2;
const RESET_TRANSITION_DELAY_MS = 250;

const LeftColumn: FC<StateProps & DispatchProps> = ({
  searchQuery,
  searchDate,
  activeChatFolder,
  setGlobalSearchQuery,
  setGlobalSearchChatId,
  resetChatCreation,
  setGlobalSearchDate,
  loadPasswordInfo,
  clearTwoFaError,
}) => {
  const [content, setContent] = useState<LeftColumnContent>(LeftColumnContent.ChatList);
  const [settingsScreen, setSettingsScreen] = useState(SettingsScreens.Main);
  const [contactsFilter, setContactsFilter] = useState<string>('');
  const [isMenuOpen, openMenu, closeMenu] = useFlag();

  const setContentWithHistory = useCallback((contentKey: LeftColumnContent) => {
    if (contentKey !== LeftColumnContent.ChatList
      && contentKey !== LeftColumnContent.NewChannelStep2
      && contentKey !== LeftColumnContent.NewGroupStep2) {
      HistoryWrapper.pushState({
        type: 'left',
        contentKey,
        isMenuOpen,
      });
    }
    setContent(contentKey);
  }, [isMenuOpen]);

  const setSettingsScreenWithHistory = useCallback((screen: SettingsScreens, noPushState = false) => {
    setSettingsScreen(screen);
    if (!noPushState) {
      HistoryWrapper.pushState({
        type: 'left',
        contentKey: LeftColumnContent.Settings,
        screen,
        isMenuOpen,
      });
    }
  }, [isMenuOpen]);

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

  const handleReset = useCallback((forceReturnToChatList?: boolean, noPushState = false) => {
    if (
      content === LeftColumnContent.NewGroupStep2
      && !forceReturnToChatList
    ) {
      if (!noPushState) HistoryWrapper.back();
      setContentWithHistory(LeftColumnContent.NewGroupStep1);
      return;
    }

    if (content === LeftColumnContent.NewGroupStep1) {
      const pickerSearchInput = document.getElementById('new-group-picker-search');
      if (pickerSearchInput) {
        pickerSearchInput.blur();
      }
    }

    if (content === LeftColumnContent.Settings) {
      if (!noPushState) {
        HistoryWrapper.back();
      }
      switch (settingsScreen) {
        case SettingsScreens.EditProfile:
        case SettingsScreens.Folders:
        case SettingsScreens.General:
        case SettingsScreens.Notifications:
        case SettingsScreens.Privacy:
        case SettingsScreens.Language:
          setSettingsScreenWithHistory(SettingsScreens.Main, noPushState);
          return;

        case SettingsScreens.GeneralChatBackground:
          setSettingsScreenWithHistory(SettingsScreens.General, noPushState);
          return;
        case SettingsScreens.GeneralChatBackgroundColor:
          setSettingsScreenWithHistory(SettingsScreens.GeneralChatBackground, noPushState);
          return;

        case SettingsScreens.PrivacyPhoneNumber:
        case SettingsScreens.PrivacyLastSeen:
        case SettingsScreens.PrivacyProfilePhoto:
        case SettingsScreens.PrivacyForwarding:
        case SettingsScreens.PrivacyGroupChats:
        case SettingsScreens.PrivacyActiveSessions:
        case SettingsScreens.PrivacyBlockedUsers:
        case SettingsScreens.TwoFaDisabled:
        case SettingsScreens.TwoFaEnabled:
        case SettingsScreens.TwoFaCongratulations:
          setSettingsScreenWithHistory(SettingsScreens.Privacy, noPushState);
          return;
        case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
        case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
          setSettingsScreenWithHistory(SettingsScreens.PrivacyPhoneNumber, noPushState);
          return;
        case SettingsScreens.PrivacyLastSeenAllowedContacts:
        case SettingsScreens.PrivacyLastSeenDeniedContacts:
          setSettingsScreenWithHistory(SettingsScreens.PrivacyLastSeen, noPushState);
          return;
        case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
        case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
          setSettingsScreenWithHistory(SettingsScreens.PrivacyProfilePhoto, noPushState);
          return;
        case SettingsScreens.PrivacyForwardingAllowedContacts:
        case SettingsScreens.PrivacyForwardingDeniedContacts:
          setSettingsScreenWithHistory(SettingsScreens.PrivacyForwarding, noPushState);
          return;
        case SettingsScreens.PrivacyGroupChatsAllowedContacts:
        case SettingsScreens.PrivacyGroupChatsDeniedContacts:
          setSettingsScreenWithHistory(SettingsScreens.PrivacyGroupChats, noPushState);
          return;
        case SettingsScreens.TwoFaNewPassword:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaDisabled, noPushState);
          return;
        case SettingsScreens.TwoFaNewPasswordConfirm:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaNewPassword, noPushState);
          return;
        case SettingsScreens.TwoFaNewPasswordHint:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaNewPasswordConfirm, noPushState);
          return;
        case SettingsScreens.TwoFaNewPasswordEmail:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaNewPasswordHint, noPushState);
          return;
        case SettingsScreens.TwoFaNewPasswordEmailCode:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaNewPasswordEmail, noPushState);
          return;
        case SettingsScreens.TwoFaChangePasswordCurrent:
        case SettingsScreens.TwoFaTurnOff:
        case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaEnabled, noPushState);
          return;
        case SettingsScreens.TwoFaChangePasswordNew:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaChangePasswordCurrent, noPushState);
          return;
        case SettingsScreens.TwoFaChangePasswordConfirm:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaChangePasswordNew, noPushState);
          return;
        case SettingsScreens.TwoFaChangePasswordHint:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaChangePasswordConfirm, noPushState);
          return;
        case SettingsScreens.TwoFaRecoveryEmail:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaRecoveryEmailCurrentPassword, noPushState);
          return;
        case SettingsScreens.TwoFaRecoveryEmailCode:
          setSettingsScreenWithHistory(SettingsScreens.TwoFaRecoveryEmail, noPushState);
          return;

        case SettingsScreens.FoldersCreateFolder:
        case SettingsScreens.FoldersEditFolder:
          setSettingsScreenWithHistory(SettingsScreens.Folders, noPushState);
          return;
        default:
          break;
      }
    }

    if (!noPushState) {
      HistoryWrapper.back();
    }

    if (content === LeftColumnContent.ChatList && activeChatFolder === 0) {
      setContentWithHistory(LeftColumnContent.GlobalSearch);
      return;
    }

    setContentWithHistory(LeftColumnContent.ChatList);
    setContactsFilter('');
    setGlobalSearchQuery({ query: '' });
    setGlobalSearchDate({ date: undefined });
    setGlobalSearchChatId({ id: undefined });
    resetChatCreation();
    setTimeout(() => {
      setLastResetTime(Date.now());
    }, RESET_TRANSITION_DELAY_MS);
  }, [
    content, activeChatFolder, setContentWithHistory, settingsScreen, setSettingsScreenWithHistory,
    setGlobalSearchQuery, setGlobalSearchDate, setGlobalSearchChatId, resetChatCreation,
  ]);

  const [shouldSkipTransition, setShouldSkipTransition] = useState(false);
  useHistoryBack((event, noAnimation, previousHistoryState) => {
    if (previousHistoryState && previousHistoryState.type === 'left') {
      if (noAnimation) {
        setShouldSkipTransition(true);
        setTimeout(() => {
          setShouldSkipTransition(false);
        }, ANIMATION_DURATION[IS_MOBILE_SCREEN ? 'slide-layers' : 'push-slide']);
      }
      handleReset(false, true);
    }
  });

  const handleSearchQuery = useCallback((query: string) => {
    if (content === LeftColumnContent.Contacts) {
      setContactsFilter(query);
      return;
    }

    setContentWithHistory(LeftColumnContent.GlobalSearch);

    if (query !== searchQuery) {
      setGlobalSearchQuery({ query });
    }
  }, [content, setContentWithHistory, searchQuery, setGlobalSearchQuery]);

  useEffect(
    () => (content !== LeftColumnContent.ChatList || activeChatFolder === 0
      ? captureEscKeyListener(() => handleReset())
      : undefined),
    [activeChatFolder, content, handleReset],
  );

  useEffect(() => {
    clearTwoFaError();

    if (settingsScreen === SettingsScreens.Privacy) {
      loadPasswordInfo();
    }
  }, [clearTwoFaError, loadPasswordInfo, settingsScreen]);

  return (
    <Transition
      id="LeftColumn"
      name={shouldSkipTransition ? 'none' : IS_MOBILE_SCREEN ? 'slide-layers' : 'push-slide'}
      renderCount={RENDER_COUNT}
      activeKey={contentType}
    >
      {(isActive) => {
        switch (contentType) {
          case ContentType.Archived:
            return (
              <ArchivedChats
                isActive={isActive}
                onReset={handleReset}
              />
            );
          case ContentType.Settings:
            return (
              <Settings
                currentScreen={settingsScreen}
                onScreenSelect={setSettingsScreenWithHistory}
                onReset={handleReset}
                shouldSkipTransition={shouldSkipTransition}
              />
            );
          case ContentType.NewChannel:
            return (
              <NewChat
                key={lastResetTime}
                isChannel
                content={content}
                onContentChange={setContentWithHistory}
                onReset={handleReset}
              />
            );
          case ContentType.NewGroup:
            return (
              <NewChat
                key={lastResetTime}
                content={content}
                onContentChange={setContentWithHistory}
                onReset={handleReset}
              />
            );
          default:
            return (
              <LeftMain
                content={content}
                searchQuery={searchQuery}
                searchDate={searchDate}
                contactsFilter={contactsFilter}
                onContentChange={setContentWithHistory}
                onSearchQuery={handleSearchQuery}
                onReset={handleReset}
                shouldSkipTransition={shouldSkipTransition}
                onOpenMenu={openMenu}
                onCloseMenu={closeMenu}
              />
            );
        }
      }}
    </Transition>
  );
};

export default memo(withGlobal(
  (global): StateProps => {
    const {
      globalSearch: {
        query,
        date,
      },
      chatFolders: {
        activeChatFolder,
      },
    } = global;
    return { searchQuery: query, searchDate: date, activeChatFolder };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setGlobalSearchQuery', 'setGlobalSearchChatId', 'resetChatCreation', 'setGlobalSearchDate',
    'loadPasswordInfo', 'clearTwoFaError',
  ]),
)(LeftColumn));
