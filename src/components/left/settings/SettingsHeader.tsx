import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { SettingsScreens } from '../../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import useLang from '../../../hooks/useLang';

import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';

type OwnProps = {
  currentScreen: SettingsScreens;
  editedFolderId?: number;
  onReset: () => void;
  onSaveFilter: () => void;
  onScreenSelect: (screen: SettingsScreens) => void;
};

const SettingsHeader: FC<OwnProps> = ({
  currentScreen,
  editedFolderId,
  onReset,
  onSaveFilter,
  onScreenSelect,
}) => {
  const {
    signOut,
    deleteChatFolder,
  } = getActions();

  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isDeleteFolderDialogOpen, setIsDeleteFolderDialogOpen] = useState(false);

  const openSignOutConfirmation = useCallback(() => {
    setIsSignOutDialogOpen(true);
  }, []);

  const closeSignOutConfirmation = useCallback(() => {
    setIsSignOutDialogOpen(false);
  }, []);

  const openDeleteFolderConfirmation = useCallback(() => {
    setIsDeleteFolderDialogOpen(true);
  }, []);

  const closeDeleteFolderConfirmation = useCallback(() => {
    setIsDeleteFolderDialogOpen(false);
  }, []);

  const handleSignOutMessage = useCallback(() => {
    closeSignOutConfirmation();
    signOut();
  }, [closeSignOutConfirmation, signOut]);

  const handleDeleteFolderMessage = useCallback(() => {
    closeDeleteFolderConfirmation();
    deleteChatFolder({ id: editedFolderId });
    onReset();
  }, [editedFolderId, closeDeleteFolderConfirmation, deleteChatFolder, onReset]);

  const SettingsMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  const lang = useLang();

  function renderHeaderContent() {
    switch (currentScreen) {
      case SettingsScreens.EditProfile:
        return <h3>{lang('lng_settings_information')}</h3>;
      case SettingsScreens.General:
        return <h3>{lang('General')}</h3>;
      case SettingsScreens.QuickReaction:
        return <h3>{lang('DoubleTapSetting')}</h3>;
      case SettingsScreens.Notifications:
        return <h3>{lang('Notifications')}</h3>;
      case SettingsScreens.DataStorage:
        return <h3>{lang('DataSettings')}</h3>;
      case SettingsScreens.Privacy:
        return <h3>{lang('PrivacySettings')}</h3>;
      case SettingsScreens.Language:
        return <h3>{lang('Language')}</h3>;

      case SettingsScreens.GeneralChatBackground:
        return <h3>{lang('ChatBackground')}</h3>;
      case SettingsScreens.GeneralChatBackgroundColor:
        return <h3>{lang('SetColor')}</h3>;

      case SettingsScreens.PrivacyPhoneNumber:
        return <h3>{lang('PrivacyPhone')}</h3>;
      case SettingsScreens.PrivacyLastSeen:
        return <h3>{lang('PrivacyLastSeen')}</h3>;
      case SettingsScreens.PrivacyProfilePhoto:
        return <h3>{lang('Privacy.ProfilePhoto')}</h3>;
      case SettingsScreens.PrivacyForwarding:
        return <h3>{lang('PrivacyForwards')}</h3>;
      case SettingsScreens.PrivacyGroupChats:
        return <h3>{lang('AutodownloadGroupChats')}</h3>;
      case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
      case SettingsScreens.PrivacyLastSeenAllowedContacts:
      case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
      case SettingsScreens.PrivacyForwardingAllowedContacts:
      case SettingsScreens.PrivacyGroupChatsAllowedContacts:
        return <h3>{lang('AlwaysShareWith')}</h3>;
      case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
      case SettingsScreens.PrivacyLastSeenDeniedContacts:
      case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
      case SettingsScreens.PrivacyForwardingDeniedContacts:
      case SettingsScreens.PrivacyGroupChatsDeniedContacts:
        return <h3>{lang('NeverShareWith')}</h3>;

      case SettingsScreens.ActiveSessions:
        return <h3>{lang('SessionsTitle')}</h3>;
      case SettingsScreens.PrivacyBlockedUsers:
        return <h3>{lang('BlockedUsers')}</h3>;

      case SettingsScreens.TwoFaDisabled:
      case SettingsScreens.TwoFaEnabled:
        return <h3>{lang('TwoStepVerification')}</h3>;
      case SettingsScreens.TwoFaNewPassword:
      case SettingsScreens.TwoFaChangePasswordNew:
      case SettingsScreens.TwoFaChangePasswordConfirm:
        return <h3>{lang('PleaseEnterCurrentPassword')}</h3>;
      case SettingsScreens.TwoFaNewPasswordConfirm:
        return <h3>{lang('PleaseReEnterPassword')}</h3>;
      case SettingsScreens.TwoFaNewPasswordHint:
      case SettingsScreens.TwoFaChangePasswordHint:
        return <h3>{lang('PasswordHint')}</h3>;
      case SettingsScreens.TwoFaNewPasswordEmail:
      case SettingsScreens.TwoFaRecoveryEmail:
        return <h3>{lang('RecoveryEmailTitle')}</h3>;
      case SettingsScreens.TwoFaNewPasswordEmailCode:
      case SettingsScreens.TwoFaRecoveryEmailCode:
        return <h3>Recovery Email Code</h3>;
      case SettingsScreens.TwoFaCongratulations:
        return <h3>{lang('TwoStepVerificationPasswordSet')}</h3>;
      case SettingsScreens.TwoFaChangePasswordCurrent:
      case SettingsScreens.TwoFaTurnOff:
      case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
        return <h3>{lang('PleaseEnterCurrentPassword')}</h3>;

      case SettingsScreens.PasscodeDisabled:
      case SettingsScreens.PasscodeEnabled:
      case SettingsScreens.PasscodeNewPasscode:
      case SettingsScreens.PasscodeNewPasscodeConfirm:
      case SettingsScreens.PasscodeCongratulations:
        return <h3>{lang('Passcode')}</h3>;

      case SettingsScreens.PasscodeTurnOff:
        return <h3>{lang('PasscodeController.Disable.Title')}</h3>;

      case SettingsScreens.PasscodeChangePasscodeCurrent:
      case SettingsScreens.PasscodeChangePasscodeNew:
        return <h3>{lang('PasscodeController.Change.Title')}</h3>;

      case SettingsScreens.PasscodeChangePasscodeConfirm:
        return <h3>{lang('PasscodeController.ReEnterPasscode.Placeholder')}</h3>;

      case SettingsScreens.Folders:
        return <h3>{lang('Filters')}</h3>;
      case SettingsScreens.FoldersCreateFolder:
        return <h3>{lang('FilterNew')}</h3>;
      case SettingsScreens.FoldersEditFolder:
      case SettingsScreens.FoldersEditFolderFromChatList:
        return (
          <div className="settings-main-header">
            <h3>{lang('FilterEdit')}</h3>

            {editedFolderId && (
              <DropdownMenu
                className="settings-more-menu"
                trigger={SettingsMenuButton}
                positionX="right"
              >
                <MenuItem icon="delete" destructive onClick={openDeleteFolderConfirmation}>
                  {lang('Delete')}
                </MenuItem>
              </DropdownMenu>
            )}
          </div>
        );
      case SettingsScreens.FoldersIncludedChats:
      case SettingsScreens.FoldersIncludedChatsFromChatList:
      case SettingsScreens.FoldersExcludedChats:
      case SettingsScreens.FoldersExcludedChatsFromChatList:
        return (
          <div className="settings-main-header">
            {(currentScreen === SettingsScreens.FoldersIncludedChats
              || currentScreen === SettingsScreens.FoldersIncludedChatsFromChatList) ? (
                <h3>{lang('FilterInclude')}</h3>
              ) : (
                <h3>{lang('FilterExclude')}</h3>
              )}

            <Button
              round
              size="smaller"
              color="translucent"
              className="color-primary"
              onClick={onSaveFilter}
              ariaLabel={lang('AutoDeleteConfirm')}
            >
              <i className="icon-check" />
            </Button>
          </div>
        );

      default:
        return (
          <div className="settings-main-header">
            <h3>{lang('SETTINGS')}</h3>

            <Button
              round
              ripple={!IS_SINGLE_COLUMN_LAYOUT}
              size="smaller"
              color="translucent"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => onScreenSelect(SettingsScreens.EditProfile)}
              ariaLabel={lang('lng_settings_information')}
            >
              <i className="icon-edit" />
            </Button>
            <DropdownMenu
              className="settings-more-menu"
              trigger={SettingsMenuButton}
              positionX="right"
            >
              <MenuItem icon="logout" onClick={openSignOutConfirmation}>{lang('LogOutTitle')}</MenuItem>
            </DropdownMenu>
          </div>
        );
    }
  }

  return (
    <div className="left-header">
      <Button
        round
        size="smaller"
        color="translucent"
        onClick={onReset}
        ariaLabel={lang('AccDescrGoBack')}
      >
        <i className="icon-arrow-left" />
      </Button>
      {renderHeaderContent()}
      <ConfirmDialog
        isOpen={isSignOutDialogOpen}
        onClose={closeSignOutConfirmation}
        text={lang('lng_sure_logout')}
        confirmLabel={lang('AccountSettings.Logout')}
        confirmHandler={handleSignOutMessage}
        confirmIsDestructive
      />
      <ConfirmDialog
        isOpen={isDeleteFolderDialogOpen}
        onClose={closeDeleteFolderConfirmation}
        text={lang('FilterDeleteAlert')}
        confirmLabel={lang('Delete')}
        confirmHandler={handleDeleteFolderMessage}
        confirmIsDestructive
      />
    </div>
  );
};

export default memo(SettingsHeader);
