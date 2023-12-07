import type { FC } from '../../../lib/teact/teact';
import React, { memo, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { FolderEditDispatch, FoldersState } from '../../../hooks/reducers/useFoldersReducer';
import { SettingsScreens } from '../../../types';

import { selectTabState } from '../../../global/selectors';
import { LAYERS_ANIMATION_NAME } from '../../../util/windowEnvironment';

import useTwoFaReducer from '../../../hooks/reducers/useTwoFaReducer';
import useLastCallback from '../../../hooks/useLastCallback';

import Transition from '../../ui/Transition';
import SettingsFolders from './folders/SettingsFolders';
import SettingsPasscode from './passcode/SettingsPasscode';
import SettingsActiveSessions from './SettingsActiveSessions';
import SettingsActiveWebsites from './SettingsActiveWebsites';
import SettingsCustomEmoji from './SettingsCustomEmoji';
import SettingsDataStorage from './SettingsDataStorage';
import SettingsDoNotTranslate from './SettingsDoNotTranslate';
import SettingsEditProfile from './SettingsEditProfile';
import SettingsExperimental from './SettingsExperimental';
import SettingsGeneral from './SettingsGeneral';
import SettingsGeneralBackground from './SettingsGeneralBackground';
import SettingsGeneralBackgroundColor from './SettingsGeneralBackgroundColor';
import SettingsHeader from './SettingsHeader';
import SettingsLanguage from './SettingsLanguage';
import SettingsMain from './SettingsMain';
import SettingsNotifications from './SettingsNotifications';
import SettingsPerformance from './SettingsPerformance';
import SettingsPrivacy from './SettingsPrivacy';
import SettingsPrivacyBlockedUsers from './SettingsPrivacyBlockedUsers';
import SettingsPrivacyVisibility from './SettingsPrivacyVisibility';
import SettingsPrivacyVisibilityExceptionList from './SettingsPrivacyVisibilityExceptionList';
import SettingsQuickReaction from './SettingsQuickReaction';
import SettingsStickers from './SettingsStickers';
import SettingsTwoFa from './twoFa/SettingsTwoFa';

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
  SettingsScreens.FoldersEditFolderInvites,
  SettingsScreens.FoldersIncludedChats,
  SettingsScreens.FoldersIncludedChatsFromChatList,
  SettingsScreens.FoldersExcludedChats,
  SettingsScreens.FoldersExcludedChatsFromChatList,
  SettingsScreens.FoldersShare,
];

const PRIVACY_SCREENS = [
  SettingsScreens.PrivacyBlockedUsers,
  SettingsScreens.ActiveWebsites,
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

const PRIVACY_BIO_SCREENS = [
  SettingsScreens.PrivacyBioAllowedContacts,
  SettingsScreens.PrivacyBioDeniedContacts,
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

const PRIVACY_VOICE_MESSAGES_SCREENS = [
  SettingsScreens.PrivacyVoiceMessagesAllowedContacts,
  SettingsScreens.PrivacyVoiceMessagesDeniedContacts,
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
  const { closeShareChatFolderModal } = getActions();

  const [twoFaState, twoFaDispatch] = useTwoFaReducer();
  const [privacyPasscode, setPrivacyPasscode] = useState<string>('');

  const handleReset = useLastCallback((forceReturnToChatList?: true | Event) => {
    const isFromSettings = selectTabState(getGlobal()).shareFolderScreen?.isFromSettings;

    if (currentScreen === SettingsScreens.FoldersShare) {
      closeShareChatFolderModal();
    }

    if (forceReturnToChatList === true || (isFromSettings !== undefined && !isFromSettings)) {
      onReset(true);
      return;
    }

    if (
      currentScreen === SettingsScreens.FoldersCreateFolder
      || currentScreen === SettingsScreens.FoldersEditFolder
      || currentScreen === SettingsScreens.FoldersEditFolderFromChatList
      || currentScreen === SettingsScreens.FoldersEditFolderInvites
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
  });

  function renderCurrentSectionContent(isScreenActive: boolean, activeScreen: SettingsScreens) {
    const privacyAllowScreens: Record<number, boolean> = {
      [SettingsScreens.PrivacyPhoneNumber]: PRIVACY_PHONE_NUMBER_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyLastSeen]: PRIVACY_LAST_SEEN_PHONE_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyProfilePhoto]: PRIVACY_PROFILE_PHOTO_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyBio]: PRIVACY_BIO_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyPhoneCall]: PRIVACY_PHONE_CALL_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyPhoneP2P]: PRIVACY_PHONE_P2P_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyForwarding]: PRIVACY_FORWARDING_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyVoiceMessages]: PRIVACY_VOICE_MESSAGES_SCREENS.includes(activeScreen),
      [SettingsScreens.PrivacyGroupChats]: PRIVACY_GROUP_CHATS_SCREENS.includes(activeScreen),
    };

    const isTwoFaScreen = TWO_FA_SCREENS.includes(activeScreen);
    const isPasscodeScreen = PASSCODE_SCREENS.includes(activeScreen);
    const isFoldersScreen = FOLDERS_SCREENS.includes(activeScreen);
    const isPrivacyScreen = PRIVACY_SCREENS.includes(activeScreen)
      || isTwoFaScreen
      || isPasscodeScreen
      || Object.keys(privacyAllowScreens).map(Number).includes(activeScreen)
      || Object.values(privacyAllowScreens).includes(true);

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
              || activeScreen === SettingsScreens.GeneralChatBackgroundColor
              || activeScreen === SettingsScreens.GeneralChatBackground
              || activeScreen === SettingsScreens.QuickReaction
              || activeScreen === SettingsScreens.CustomEmoji
              || isPrivacyScreen || isFoldersScreen}
            onReset={handleReset}
          />
        );
      case SettingsScreens.QuickReaction:
        return (
          <SettingsQuickReaction isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.CustomEmoji:
        return (
          <SettingsCustomEmoji isActive={isScreenActive} onReset={handleReset} />
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
          <SettingsLanguage
            isActive={isScreenActive || activeScreen === SettingsScreens.DoNotTranslate}
            onReset={handleReset}
            onScreenSelect={onScreenSelect}
          />
        );
      case SettingsScreens.DoNotTranslate:
        return (
          <SettingsDoNotTranslate isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.Stickers:
        return (
          <SettingsStickers isActive={isScreenActive} onReset={handleReset} onScreenSelect={onScreenSelect} />
        );
      case SettingsScreens.Experimental:
        return (
          <SettingsExperimental isActive={isScreenActive} onReset={handleReset} />
        );
      case SettingsScreens.GeneralChatBackground:
        return (
          <SettingsGeneralBackground
            onScreenSelect={onScreenSelect}
            isActive={isScreenActive || activeScreen === SettingsScreens.GeneralChatBackgroundColor}
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
      case SettingsScreens.ActiveWebsites:
        return (
          <SettingsActiveWebsites
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
      case SettingsScreens.PrivacyBio:
      case SettingsScreens.PrivacyPhoneCall:
      case SettingsScreens.PrivacyForwarding:
      case SettingsScreens.PrivacyVoiceMessages:
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
      case SettingsScreens.PrivacyBioAllowedContacts:
      case SettingsScreens.PrivacyPhoneCallAllowedContacts:
      case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
      case SettingsScreens.PrivacyForwardingAllowedContacts:
      case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
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
      case SettingsScreens.PrivacyBioDeniedContacts:
      case SettingsScreens.PrivacyPhoneCallDeniedContacts:
      case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
      case SettingsScreens.PrivacyForwardingDeniedContacts:
      case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
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
      case SettingsScreens.FoldersEditFolderInvites:
      case SettingsScreens.FoldersIncludedChats:
      case SettingsScreens.FoldersIncludedChatsFromChatList:
      case SettingsScreens.FoldersExcludedChats:
      case SettingsScreens.FoldersExcludedChatsFromChatList:
      case SettingsScreens.FoldersShare:
        return (
          <SettingsFolders
            currentScreen={currentScreen}
            shownScreen={activeScreen}
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
            shownScreen={activeScreen}
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
            shownScreen={activeScreen}
            isActive={isScreenActive}
            onScreenSelect={onScreenSelect}
            onReset={handleReset}
          />
        );

      case SettingsScreens.Performance:
        return (
          <SettingsPerformance
            isActive={isScreenActive}
            onReset={handleReset}
          />
        );

      default:
        return undefined;
    }
  }

  function renderCurrentSection(
    isScreenActive: boolean,
    _isFrom: boolean,
    _currentKey: SettingsScreens,
    activeKey: SettingsScreens,
  ) {
    return (
      <>
        <SettingsHeader
          currentScreen={currentScreen}
          onReset={handleReset}
          onScreenSelect={onScreenSelect}
          editedFolderId={foldersState.folderId}
        />
        {renderCurrentSectionContent(isScreenActive, activeKey)}
      </>
    );
  }

  return (
    <Transition
      id="Settings"
      name={shouldSkipTransition ? 'none' : LAYERS_ANIMATION_NAME}
      activeKey={currentScreen}
      renderCount={TRANSITION_RENDER_COUNT}
      shouldWrap
      withSwipeControl
    >
      {renderCurrentSection}
    </Transition>
  );
};

export default memo(Settings);
