import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { LeftColumnContent, SettingsScreens } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { pick } from '../../util/iteratees';

import Transition from '../ui/Transition';
import LeftMain from './main/LeftMain';
import Settings from './settings/Settings.async';
import NewChat from './newChat/NewChat.async';
import ArchivedChats from './ArchivedChats.async';

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

  const handleReset = useCallback((forceReturnToChatList?: boolean) => {
    if (
      content === LeftColumnContent.NewGroupStep2
      && !forceReturnToChatList
    ) {
      setContent(LeftColumnContent.NewGroupStep1);
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
        case SettingsScreens.Privacy:
        case SettingsScreens.Language:
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
        case SettingsScreens.PrivacyForwarding:
        case SettingsScreens.PrivacyGroupChats:
        case SettingsScreens.PrivacyActiveSessions:
        case SettingsScreens.PrivacyBlockedUsers:
        case SettingsScreens.TwoFaDisabled:
        case SettingsScreens.TwoFaEnabled:
        case SettingsScreens.TwoFaCongratulations:
          setSettingsScreen(SettingsScreens.Privacy);
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
        case SettingsScreens.PrivacyForwardingAllowedContacts:
        case SettingsScreens.PrivacyForwardingDeniedContacts:
          setSettingsScreen(SettingsScreens.PrivacyForwarding);
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
        default:
          break;
      }
    }

    if (content === LeftColumnContent.ChatList && activeChatFolder === 0) {
      setContent(LeftColumnContent.GlobalSearch);
      return;
    }

    setContent(LeftColumnContent.ChatList);
    setContactsFilter('');
    setGlobalSearchQuery({ query: '' });
    setGlobalSearchDate({ date: undefined });
    setGlobalSearchChatId({ id: undefined });
    resetChatCreation();
    setTimeout(() => {
      setLastResetTime(Date.now());
    }, RESET_TRANSITION_DELAY_MS);
  }, [
    content, activeChatFolder, setGlobalSearchQuery, setGlobalSearchDate, setGlobalSearchChatId, resetChatCreation,
    settingsScreen,
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
  }, [content, setGlobalSearchQuery, searchQuery]);

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
      name={IS_SINGLE_COLUMN_LAYOUT ? 'slide-layers' : 'push-slide'}
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
                onScreenSelect={setSettingsScreen}
                onReset={handleReset}
              />
            );
          case ContentType.NewChannel:
            return (
              <NewChat
                key={lastResetTime}
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
                content={content}
                onContentChange={setContent}
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
                onContentChange={setContent}
                onSearchQuery={handleSearchQuery}
                onReset={handleReset}
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
