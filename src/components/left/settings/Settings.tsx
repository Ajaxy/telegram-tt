import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../../lib/teact/teact';

import { SettingsScreens } from '../../../types';
import type { FolderEditDispatch, FoldersState } from '../../../hooks/reducers/useFoldersReducer';

import { LAYERS_ANIMATION_NAME } from '../../../util/environment';
import useTwoFaReducer from '../../../hooks/reducers/useTwoFaReducer';

import Transition from '../../ui/Transition';
import SettingsHeader from './SettingsHeader';
import SettingsMain from './SettingsMain';
import SettingsEditProfile from './SettingsEditProfile';
import SettingsDataStorage from './SettingsDataStorage';
import SettingsFolders from './folders/SettingsFolders';
import SettingsGeneral from './SettingsGeneral';
import SettingsGeneralBackground from './SettingsGeneralBackground';
import SettingsGeneralBackgroundColor from './SettingsGeneralBackgroundColor';
import SettingsNotifications from './SettingsNotifications';
import SettingsPrivacy from './SettingsPrivacy';
import SettingsLanguage from './SettingsLanguage';
import SettingsPrivacyVisibility from './SettingsPrivacyVisibility';
import SettingsActiveSessions from './SettingsActiveSessions';
import SettingsPrivacyBlockedUsers from './SettingsPrivacyBlockedUsers';
import SettingsTwoFa from './twoFa/SettingsTwoFa';
import SettingsPrivacyVisibilityExceptionList from './SettingsPrivacyVisibilityExceptionList';
import SettingsQuickReaction from './SettingsQuickReaction';
import SettingsPasscode from './passcode/SettingsPasscode';

import './Settings.scss';

const TRANSITION_RENDER_COUNT = Object.keys(SettingsScreens).length / 2;
const TRANSITION_DURATION = 200;

const TWO_FA_SCREENS = [
  SettingsScreens.TwoFaDisabled,
  SettingsScreens.TwoFaNewPassword,
  SettingsScreens.TwoFaNewPasswordConfirm,
  SettingsScreens.TwoFaNewPasswordHint,
  SettingsScreens.TwoFaNewPasswordEmail,
  SettingsScreens.TwoFaNewPasswordEmailCode,
  SettingsScreens.TwoFaCongratulations,
  SettingsScreens.TwoFaEnabled,
  SettingsScreens.TwoFaChangePasswordCurrent,
  SettingsScreens.TwoFaChangePasswordNew,
  SettingsScreens.TwoFaChangePasswordConfirm,
  SettingsScreens.TwoFaChangePasswordHint,
  SettingsScreens.TwoFaTurnOff,
  SettingsScreens.TwoFaRecoveryEmailCurrentPassword,
  SettingsScreens.TwoFaRecoveryEmail,
  SettingsScreens.TwoFaRecoveryEmailCode,
];

const PASSCODE_SCREENS = [
  SettingsScreens.PasscodeDisabled,
  SettingsScreens.PasscodeEnabled,
];

const FOLDERS_SCREENS = [
  SettingsScreens.Folders,
  SettingsScreens.FoldersCreateFolder,
  SettingsScreens.FoldersEditFolder,
  SettingsScreens.FoldersEditFolderFromChatList,
  SettingsScreens.FoldersIncludedChats,
  SettingsScreens.FoldersIncludedChatsFromChatList,
  SettingsScreens.FoldersExcludedChats,
  SettingsScreens.FoldersExcludedChatsFromChatList,
];

const PRIVACY_SCREENS = [
  SettingsScreens.PrivacyBlockedUsers,
  SettingsScreens.ActiveSessions,
];

const PRIVACY_PHONE_NUMBER_SCREENS = [
  SettingsScreens.PrivacyPhoneNumberAllowedContacts,
  SettingsScreens.PrivacyPhoneNumberDeniedContacts,
];

const PRIVACY_LAST_SEEN_PHONE_SCREENS = [
  SettingsScreens.PrivacyLastSeenAllowedContacts,
  SettingsScreens.PrivacyLastSeenDeniedContacts,
];

const PRIVACY_PROFILE_PHOTO_SCREENS = [
  SettingsScreens.PrivacyProfilePhotoAllowedContacts,
  SettingsScreens.PrivacyProfilePhotoDeniedContacts,
];

const PRIVACY_PHONE_CALL_SCREENS = [
  SettingsScreens.PrivacyPhoneCallAllowedContacts,
  SettingsScreens.PrivacyPhoneCallDeniedContacts,
];

const PRIVACY_PHONE_P2P_SCREENS = [
  SettingsScreens.PrivacyPhoneP2PAllowedContacts,
  SettingsScreens.PrivacyPhoneP2PDeniedContacts,
];

const PRIVACY_FORWARDING_SCREENS = [
  SettingsScreens.PrivacyForwardingAllowedContacts,
  SettingsScreens.PrivacyForwardingDeniedContacts,
];

const PRIVACY_GROUP_CHATS_SCREENS = [
  SettingsScreens.PrivacyGroupChatsAllowedContacts,
  SettingsScreens.PrivacyGroupChatsDeniedContacts,
];

export type OwnProps = {
  isActive: boolean;
  currentScreen: SettingsScreens;
  foldersState: FoldersState;
  foldersDispatch: FolderEditDispatch;
  onScreenSelect: (screen: SettingsScreens) => void;
  shouldSkipTransition?: boolean;
  onReset: (forceReturnToChatList?: true | Event) => void;
};

const Settings: FC<OwnProps> = ({
  isActive,
  currentScreen,
  foldersState,
  foldersDispatch,
  onScreenSelect,
  onReset,
  shouldSkipTransition,
}) => {
  const [twoFaState, twoFaDispatch] = useTwoFaReducer();
  const [privacyPasscode, setPrivacyPasscode] = useState<string>('');

  const handleReset = useCallback((forceReturnToChatList?: true | Event) => {
    if (forceReturnToChatList === true) {
      onReset(true);
      return;
    }

    if (
      currentScreen === SettingsScreens.FoldersCreateFolder
      || currentScreen === SettingsScreens.FoldersEditFolder
      || currentScreen === SettingsScreens.FoldersEditFolderFromChatList
    ) {
      setTimeout(() => {
        foldersDispatch({ type: 'reset' });
      }, TRANSITION_DURATION);
    }

    if (
      currentScreen === SettingsScreens.FoldersIncludedChats
      || currentScreen === SettingsScreens.FoldersExcludedChats
    ) {
      if (foldersState.mode === 'create') {
        onScreenSelect(SettingsScreens.FoldersCreateFolder);
      } else {
        onScreenSelect(SettingsScreens.FoldersEditFolder);
      }
      return;
    }

    onReset();
  }, [
    foldersState.mode, foldersDispatch,
    currentScreen, onReset, onScreenSelect,
  ]);

  const handleSaveFilter = useCallback(() => {
    foldersDispatch({ type: 'saveFilters' });
    handleReset();
  }, [foldersDispatch, handleReset]);

  function renderCurrentSectionContent(isScreenActive: boolean, screen: SettingsScreens) {
    const privacyAllowScreens: Record<number, boolean> = {
      [SettingsScreens.PrivacyPhoneNumber]: PRIVACY_PHONE_NUMBER_SCREENS.includes(screen),
      [SettingsScreens.PrivacyLastSeen]: PRIVACY_LAST_SEEN_PHONE_SCREENS.includes(screen),
      [SettingsScreens.PrivacyProfilePhoto]: PRIVACY_PROFILE_PHOTO_SCREENS.includes(screen),
      [SettingsScreens.PrivacyPhoneCall]: PRIVACY_PHONE_CALL_SCREENS.includes(screen),
      [SettingsScreens.PrivacyPhoneP2P]: PRIVACY_PHONE_P2P_SCREENS.includes(screen),
      [SettingsScreens.PrivacyForwarding]: PRIVACY_FORWARDING_SCREENS.includes(screen),
      [SettingsScreens.PrivacyGroupChats]: PRIVACY_GROUP_CHATS_SCREENS.includes(screen),
    };

    const isTwoFaScreen = TWO_FA_SCREENS.includes(screen);
    const isPasscodeScreen = PASSCODE_SCREENS.includes(screen);
    const isFoldersScreen = FOLDERS_SCREENS.includes(screen);
    const isPrivacyScreen = PRIVACY_SCREENS.includes(screen)
      || isTwoFaScreen
      || isPasscodeScreen
      || Object.keys(privacyAllowScreens).includes(screen.toString())
      || Object.values(privacyAllowScreens).find((key) => key === true);

    switch (currentScreen) {
      case SettingsScreens.Main:
        return (
          <SettingsMain onScreenSelect={onScreenSelect} isActive={isActive} onReset={handleReset} />
        );
      case SettingsScreens.EditProfile:
        return (
          <SettingsEditProfile
            isActive={isActive && isScreenActive}
            onReset={handleReset}
          />
        );
      case SettingsScreens.General:
        return (
          <SettingsGeneral
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive
              || screen === SettingsScreens.GeneralChatBackgroundColor
              || screen === SettingsScreens.GeneralChatBackground
              || screen === SettingsScreens.QuickReaction
              || isPrivacyScreen || isFoldersScreen}
            onReset={handleReset}
          />
        );
      case SettingsScreens.QuickReaction:
        return (
          <SettingsQuickReaction isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.Notifications:
        return (
          <SettingsNotifications isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.DataStorage:
        return (
          <SettingsDataStorage isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.Privacy:
        return (
          <SettingsPrivacy
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive || isPrivacyScreen}
            onReset={handleReset}
          />
        );
      case SettingsScreens.Language:
        return (
          <SettingsLanguage isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.GeneralChatBackground:
        return (
          <SettingsGeneralBackground
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive || screen === SettingsScreens.GeneralChatBackgroundColor}
            onReset={handleReset}
          />
        );
      case SettingsScreens.GeneralChatBackgroundColor:
        return (
          <SettingsGeneralBackgroundColor
            isActive={isScreenActive}
            onReset={handleReset}
          />
        );
      case SettingsScreens.ActiveSessions:
        return (
          <SettingsActiveSessions
            isActive={isScreenActive}
            onReset={handleReset}
          />
        );
      case SettingsScreens.PrivacyBlockedUsers:
        return (
          <SettingsPrivacyBlockedUsers
            isActive={isScreenActive}
            onReset={handleReset}
          />
        );
      case SettingsScreens.PrivacyPhoneNumber:
      case SettingsScreens.PrivacyLastSeen:
      case SettingsScreens.PrivacyProfilePhoto:
      case SettingsScreens.PrivacyPhoneCall:
      case SettingsScreens.PrivacyPhoneP2P:
      case SettingsScreens.PrivacyForwarding:
      case SettingsScreens.PrivacyGroupChats:
        return (
          <SettingsPrivacyVisibility
            screen={currentScreen}
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive || privacyAllowScreens[currentScreen]}
            onReset={handleReset}
          />
        );

      case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
      case SettingsScreens.PrivacyLastSeenAllowedContacts:
      case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
      case SettingsScreens.PrivacyPhoneCallAllowedContacts:
      case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
      case SettingsScreens.PrivacyForwardingAllowedContacts:
      case SettingsScreens.PrivacyGroupChatsAllowedContacts:
        return (
          <SettingsPrivacyVisibilityExceptionList
            isAllowList
            screen={currentScreen}
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive || privacyAllowScreens[currentScreen]}
            onReset={handleReset}
          />
        );

      case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
      case SettingsScreens.PrivacyLastSeenDeniedContacts:
      case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
      case SettingsScreens.PrivacyPhoneCallDeniedContacts:
      case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
      case SettingsScreens.PrivacyForwardingDeniedContacts:
      case SettingsScreens.PrivacyGroupChatsDeniedContacts:
        return (
          <SettingsPrivacyVisibilityExceptionList
            screen={currentScreen}
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive}
            onReset={handleReset}
          />
        );

      case SettingsScreens.Folders:
      case SettingsScreens.FoldersCreateFolder:
      case SettingsScreens.FoldersEditFolder:
      case SettingsScreens.FoldersEditFolderFromChatList:
      case SettingsScreens.FoldersIncludedChats:
      case SettingsScreens.FoldersIncludedChatsFromChatList:
      case SettingsScreens.FoldersExcludedChats:
      case SettingsScreens.FoldersExcludedChatsFromChatList:
        return (
          <SettingsFolders
            currentScreen={currentScreen}
            shownScreen={screen}
            state={foldersState}
            dispatch={foldersDispatch}
            isActive={isScreenActive}
            onScreenSelect={onScreenSelect}
            onReset={handleReset}
          />
        );

      case SettingsScreens.TwoFaDisabled:
      case SettingsScreens.TwoFaNewPassword:
      case SettingsScreens.TwoFaNewPasswordConfirm:
      case SettingsScreens.TwoFaNewPasswordHint:
      case SettingsScreens.TwoFaNewPasswordEmail:
      case SettingsScreens.TwoFaNewPasswordEmailCode:
      case SettingsScreens.TwoFaCongratulations:
      case SettingsScreens.TwoFaEnabled:
      case SettingsScreens.TwoFaChangePasswordCurrent:
      case SettingsScreens.TwoFaChangePasswordNew:
      case SettingsScreens.TwoFaChangePasswordConfirm:
      case SettingsScreens.TwoFaChangePasswordHint:
      case SettingsScreens.TwoFaTurnOff:
      case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
      case SettingsScreens.TwoFaRecoveryEmail:
      case SettingsScreens.TwoFaRecoveryEmailCode:
        return (
          <SettingsTwoFa
            currentScreen={currentScreen}
            state={twoFaState}
            dispatch={twoFaDispatch}
            shownScreen={screen}
            isActive={isScreenActive}
            onScreenSelect={onScreenSelect}
            onReset={handleReset}
          />
        );

      case SettingsScreens.PasscodeDisabled:
      case SettingsScreens.PasscodeNewPasscode:
      case SettingsScreens.PasscodeNewPasscodeConfirm:
      case SettingsScreens.PasscodeChangePasscodeCurrent:
      case SettingsScreens.PasscodeChangePasscodeNew:
      case SettingsScreens.PasscodeChangePasscodeConfirm:
      case SettingsScreens.PasscodeCongratulations:
      case SettingsScreens.PasscodeEnabled:
      case SettingsScreens.PasscodeTurnOff:
        return (
          <SettingsPasscode
            currentScreen={currentScreen}
            passcode={privacyPasscode}
            onSetPasscode={setPrivacyPasscode}
            shownScreen={screen}
            isActive={isScreenActive}
            onScreenSelect={onScreenSelect}
            onReset={handleReset}
          />
        );

      default:
        return undefined;
    }
  }

  function renderCurrentSection(isScreenActive: boolean, isFrom: boolean, currentKey: SettingsScreens) {
    return (
      <>
        <SettingsHeader
          currentScreen={currentScreen}
          onReset={handleReset}
          onSaveFilter={handleSaveFilter}
          onScreenSelect={onScreenSelect}
          editedFolderId={foldersState.folderId}
        />
        {renderCurrentSectionContent(isScreenActive, currentKey)}
      </>
    );
  }

  return (
    <Transition
      id="Settings"
      name={shouldSkipTransition ? 'none' : LAYERS_ANIMATION_NAME}
      activeKey={currentScreen}
      renderCount={TRANSITION_RENDER_COUNT}
    >
      {renderCurrentSection}
    </Transition>
  );
};

export default memo(Settings);
