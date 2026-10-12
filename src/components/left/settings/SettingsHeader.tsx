import {
  memo, useCallback, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, getPromiseActions } from '../../../global';

import { SettingsScreens } from '../../../types';

import {
  selectHasLocalOnlyWalletPhrase, selectIsWalletAvailable, selectWalletLocalOnlyNanos, selectWalletSavedWallets,
} from '../../../global/selectors';
import { formatTonShortFromNanos } from '../../../util/formatCurrency';
import { formatTonAsIcon } from '../../../util/localization/format';
import { pause } from '../../../util/schedulers';

import useSelector from '../../../hooks/data/useSelector';
import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMultiClick from '../../../hooks/useMultiClick';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import ConfirmDialog from '../../ui/ConfirmDialog';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';

const WALLET_CHECK_TIMEOUT = 10000;

type OwnProps = {
  currentScreen: SettingsScreens;
  editedFolderId?: number;
  hasProfileBackground?: boolean;
  onReset: () => void;
};

const SettingsHeader = ({
  currentScreen,
  editedFolderId,
  hasProfileBackground,
  onReset,
}: OwnProps) => {
  const {
    signOut,
    openDeleteChatFolderModal,
    openSettingsScreen,
  } = getActions();

  const { isMobile } = useAppLayout();
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [isCheckingWallets, markCheckingWallets, unmarkCheckingWallets] = useFlag();
  const walletCheckIdRef = useRef(0);
  const isWalletAvailable = useSelector(selectIsWalletAvailable);
  const hasLocalOnlyWalletPhrase = useSelector(selectHasLocalOnlyWalletPhrase);
  const localOnlyWalletNanos = useSelector(selectWalletLocalOnlyNanos);
  const savedWallets = useSelector(selectWalletSavedWallets);
  // A phrase stored only on this device is lost on logout whatever its balance, so the warning does not wait for the sum
  const hasUnbackedWallet = isWalletAvailable && (hasLocalOnlyWalletPhrase || Boolean(savedWallets?.length));
  const unbackedWalletNanos = useMemo(() => (
    savedWallets?.reduce((sum, { balance }) => sum + (balance ?? 0), localOnlyWalletNanos) ?? localOnlyWalletNanos
  ), [savedWallets, localOnlyWalletNanos]);

  const handleMultiClick = useMultiClick(5, () => {
    openSettingsScreen({ screen: SettingsScreens.Experimental });
  });

  // Until the checks answer, the dialog would offer a logout that deletes the local phrases, so the button waits,
  // but no longer than `WALLET_CHECK_TIMEOUT` in case a check stalls
  const openSignOutConfirmation = useLastCallback(async () => {
    setIsSignOutDialogOpen(true);

    if (!getGlobal().appConfig.isWalletAvailable) return;

    const checkId = ++walletCheckIdRef.current;
    markCheckingWallets();

    const { loadWalletState, loadSavedWallets } = getPromiseActions();

    await Promise.race([
      (async () => {
        await loadWalletState();
        await loadSavedWallets();
      })(),
      pause(WALLET_CHECK_TIMEOUT),
    ]);

    if (checkId === walletCheckIdRef.current) {
      unmarkCheckingWallets();
    }
  });

  const closeSignOutConfirmation = useCallback(() => {
    setIsSignOutDialogOpen(false);
  }, []);

  const openDeleteFolderConfirmation = useCallback(() => {
    if (!editedFolderId) return;

    openDeleteChatFolderModal({ folderId: editedFolderId });
  }, [editedFolderId, openDeleteChatFolderModal]);

  const handleSignOutMessage = useCallback(() => {
    closeSignOutConfirmation();
    signOut({ forceInitApi: true });
  }, [closeSignOutConfirmation, signOut]);

  const SettingsMenuButton = useMemo(() => {
    return ({ onTrigger, isOpen }: { onTrigger: () => void; isOpen?: boolean }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
        iconName="more"
      />
    );
  }, [isMobile]);

  const oldLang = useOldLang();
  const lang = useLang();

  function renderHeaderContent() {
    switch (currentScreen) {
      case SettingsScreens.EditProfile:
        return <h3>{oldLang('lng_settings_information')}</h3>;
      case SettingsScreens.General:
        return <h3>{oldLang('General')}</h3>;
      case SettingsScreens.QuickReaction:
        return <h3>{oldLang('DoubleTapSetting')}</h3>;
      case SettingsScreens.CustomEmoji:
        return <h3>{oldLang('Emoji')}</h3>;
      case SettingsScreens.Notifications:
        return <h3>{oldLang('Notifications')}</h3>;
      case SettingsScreens.DataStorage:
        return <h3>{oldLang('DataSettings')}</h3>;
      case SettingsScreens.Privacy:
        return <h3>{oldLang('PrivacySettings')}</h3>;
      case SettingsScreens.AutoDeleteMessages:
        return <h3>{lang('AutoDeleteMessages')}</h3>;
      case SettingsScreens.Language:
        return <h3>{oldLang('Language')}</h3>;
      case SettingsScreens.DoNotTranslate:
        return <h3>{oldLang('DoNotTranslate')}</h3>;
      case SettingsScreens.Stickers:
        return <h3>{oldLang('StickersName')}</h3>;
      case SettingsScreens.Experimental:
        return <h3>{oldLang('lng_settings_experimental')}</h3>;

      case SettingsScreens.GeneralChatBackground:
        return <h3>{oldLang('ChatBackground')}</h3>;
      case SettingsScreens.GeneralChatBackgroundColor:
        return <h3>{oldLang('SetColor')}</h3>;

      case SettingsScreens.PrivacyPhoneNumber:
        return <h3>{oldLang('PrivacyPhone')}</h3>;
      case SettingsScreens.PrivacyLastSeen:
        return <h3>{oldLang('PrivacyLastSeen')}</h3>;
      case SettingsScreens.PrivacyProfilePhoto:
        return <h3>{oldLang('Privacy.ProfilePhoto')}</h3>;
      case SettingsScreens.PrivacyBio:
        return <h3>{oldLang('PrivacyBio')}</h3>;
      case SettingsScreens.PrivacyBirthday:
        return <h3>{oldLang('PrivacyBirthday')}</h3>;
      case SettingsScreens.PrivacyGifts:
        return <h3>{lang('PrivacyGifts')}</h3>;
      case SettingsScreens.PrivacySavedMusic:
        return <h3>{lang('PrivacyMusic')}</h3>;
      case SettingsScreens.PrivacyForwarding:
        return <h3>{oldLang('PrivacyForwards')}</h3>;
      case SettingsScreens.PrivacyVoiceMessages:
        return <h3>{oldLang('PrivacyVoiceMessages')}</h3>;
      case SettingsScreens.PrivacyMessages:
        return <h3>{oldLang('PrivacyMessages')}</h3>;
      case SettingsScreens.PrivacyGroupChats:
        return <h3>{oldLang('AutodownloadGroupChats')}</h3>;
      case SettingsScreens.PrivacyPhoneCall:
        return <h3>{oldLang('Calls')}</h3>;

      case SettingsScreens.PrivacyLastSeenAllowedContacts:
      case SettingsScreens.PrivacyProfilePhotoAllowedContacts:
      case SettingsScreens.PrivacyBioAllowedContacts:
      case SettingsScreens.PrivacyGroupChatsAllowedContacts:
      case SettingsScreens.PrivacySavedMusicAllowedContacts:
        return <h3>{oldLang('AlwaysShareWith')}</h3>;

      case SettingsScreens.PrivacyLastSeenDeniedContacts:
      case SettingsScreens.PrivacyProfilePhotoDeniedContacts:
      case SettingsScreens.PrivacyBioDeniedContacts:
      case SettingsScreens.PrivacyGroupChatsDeniedContacts:
      case SettingsScreens.PrivacySavedMusicDeniedContacts:
        return <h3>{oldLang('NeverShareWith')}</h3>;

      case SettingsScreens.PrivacyPhoneNumberAllowedContacts:
      case SettingsScreens.PrivacyBirthdayAllowedContacts:
      case SettingsScreens.PrivacyGiftsAllowedContacts:
      case SettingsScreens.PrivacyForwardingAllowedContacts:
      case SettingsScreens.PrivacyVoiceMessagesAllowedContacts:
      case SettingsScreens.PrivacyPhoneCallAllowedContacts:
      case SettingsScreens.PrivacyPhoneP2PAllowedContacts:
        return <h3>{oldLang('AlwaysAllow')}</h3>;

      case SettingsScreens.PrivacyPhoneNumberDeniedContacts:
      case SettingsScreens.PrivacyBirthdayDeniedContacts:
      case SettingsScreens.PrivacyGiftsDeniedContacts:
      case SettingsScreens.PrivacyForwardingDeniedContacts:
      case SettingsScreens.PrivacyVoiceMessagesDeniedContacts:
      case SettingsScreens.PrivacyPhoneCallDeniedContacts:
      case SettingsScreens.PrivacyPhoneP2PDeniedContacts:
        return <h3>{oldLang('NeverAllow')}</h3>;

      case SettingsScreens.PrivacyNoPaidMessages:
        return <h3>{lang('RemoveFeeTitle')}</h3>;

      case SettingsScreens.Performance:
        return <h3>{lang('MenuAnimations')}</h3>;

      case SettingsScreens.ActiveSessions:
        return <h3>{oldLang('SessionsTitle')}</h3>;
      case SettingsScreens.ActiveWebsites:
        return <h3>{oldLang('OtherWebSessions')}</h3>;
      case SettingsScreens.PrivacyBlockedUsers:
        return <h3>{oldLang('BlockedUsers')}</h3>;

      case SettingsScreens.TwoFaDisabled:
      case SettingsScreens.TwoFaEnabled:
        return <h3>{oldLang('TwoStepVerification')}</h3>;
      case SettingsScreens.TwoFaNewPassword:
      case SettingsScreens.TwoFaChangePasswordNew:
      case SettingsScreens.TwoFaChangePasswordConfirm:
        return <h3>{oldLang('PleaseEnterCurrentPassword')}</h3>;
      case SettingsScreens.TwoFaNewPasswordConfirm:
        return <h3>{oldLang('PleaseReEnterPassword')}</h3>;
      case SettingsScreens.TwoFaNewPasswordHint:
      case SettingsScreens.TwoFaChangePasswordHint:
        return <h3>{oldLang('PasswordHint')}</h3>;
      case SettingsScreens.TwoFaNewPasswordEmail:
      case SettingsScreens.TwoFaRecoveryEmail:
        return <h3>{oldLang('RecoveryEmailTitle')}</h3>;
      case SettingsScreens.TwoFaNewPasswordEmailCode:
      case SettingsScreens.TwoFaRecoveryEmailCode:
        return <h3>Recovery Email Code</h3>;
      case SettingsScreens.TwoFaCongratulations:
        return <h3>{oldLang('TwoStepVerificationPasswordSet')}</h3>;
      case SettingsScreens.TwoFaChangePasswordCurrent:
      case SettingsScreens.TwoFaTurnOff:
      case SettingsScreens.TwoFaRecoveryEmailCurrentPassword:
        return <h3>{oldLang('PleaseEnterCurrentPassword')}</h3>;

      case SettingsScreens.PasscodeDisabled:
      case SettingsScreens.PasscodeEnabled:
      case SettingsScreens.PasscodeNewPasscode:
      case SettingsScreens.PasscodeNewPasscodeConfirm:
      case SettingsScreens.PasscodePasskeyAddConfirm:
      case SettingsScreens.PasscodePasskeyRemoveConfirm:
      case SettingsScreens.PasscodeCongratulations:
        return <h3>{oldLang('Passcode')}</h3>;

      case SettingsScreens.PasscodeTurnOff:
        return <h3>{oldLang('PasscodeController.Disable.Title')}</h3>;

      case SettingsScreens.PasscodeChangePasscodeCurrent:
      case SettingsScreens.PasscodeChangePasscodeNew:
        return <h3>{oldLang('PasscodeController.Change.Title')}</h3>;

      case SettingsScreens.PasscodeChangePasscodeConfirm:
        return <h3>{oldLang('PasscodeController.ReEnterPasscode.Placeholder')}</h3>;

      case SettingsScreens.Folders:
        return <h3>{oldLang('Filters')}</h3>;
      case SettingsScreens.FoldersCreateFolder:
        return <h3>{oldLang('FilterNew')}</h3>;
      case SettingsScreens.FoldersShare:
        return <h3>{oldLang('FolderLinkScreen.Title')}</h3>;
      case SettingsScreens.FoldersEditFolder:
      case SettingsScreens.FoldersEditFolderFromChatList:
      case SettingsScreens.FoldersEditFolderInvites:
        return (
          <div className="settings-main-header">
            <h3>{oldLang('FilterEdit')}</h3>
            {Boolean(editedFolderId) && (
              <DropdownMenu
                className="settings-more-menu"
                trigger={SettingsMenuButton}
                positionX="right"
              >
                <MenuItem icon="delete" destructive onClick={openDeleteFolderConfirmation}>
                  {oldLang('Delete')}
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
          <h3>
            {oldLang(
              currentScreen === SettingsScreens.FoldersIncludedChats
              || currentScreen === SettingsScreens.FoldersIncludedChatsFromChatList
                ? 'FilterInclude' : 'FilterExclude',
            )}
          </h3>
        );

      case SettingsScreens.Passkeys:
        return <h3>{lang('SettingsPasskeyTitle')}</h3>;

      default:
        return (
          <div className="settings-main-header">
            <h3 onClick={handleMultiClick}>
              {oldLang('SETTINGS')}
            </h3>

            <Button
              round
              ripple={!isMobile}
              size="smaller"
              color="translucent"
              onClick={() => openSettingsScreen({ screen: SettingsScreens.EditProfile })}
              ariaLabel={oldLang('lng_settings_information')}
              iconName="edit"
            />
            <DropdownMenu
              className="settings-more-menu"
              trigger={SettingsMenuButton}
              positionX="right"
            >
              <MenuItem icon="logout" onClick={openSignOutConfirmation}>{oldLang('LogOutTitle')}</MenuItem>
            </DropdownMenu>
          </div>
        );
    }
  }

  return (
    <div className={hasProfileBackground && currentScreen === SettingsScreens.Main
      ? 'left-header' : 'left-header secondary'}
    >
      <Button
        round
        size="smaller"
        color="translucent"
        onClick={onReset}
        ariaLabel={oldLang('AccDescrGoBack')}
        iconName="arrow-left"
      />
      {renderHeaderContent()}
      <ConfirmDialog
        isOpen={isSignOutDialogOpen}
        onClose={closeSignOutConfirmation}
        text={hasUnbackedWallet ? undefined : oldLang('lng_sure_logout')}
        textParts={hasUnbackedWallet ? (
          <p>
            {lang(
              'AreYouSureLogoutGrams',
              { amount: formatTonAsIcon(lang, formatTonShortFromNanos(unbackedWalletNanos)) },
              { withNodes: true, withMarkdown: true, renderTextFilters: ['br'] },
            )}
          </p>
        ) : undefined}
        confirmLabel={oldLang('AccountSettings.Logout')}
        confirmHandler={handleSignOutMessage}
        confirmIsDestructive
        isConfirmLoading={isCheckingWallets}
      />
    </div>
  );
};

export default memo(SettingsHeader);
