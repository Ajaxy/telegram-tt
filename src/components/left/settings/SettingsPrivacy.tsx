import type { FC } from '../../../lib/teact/teact';
import { memo, useCallback, useEffect, useMemo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPrivacySettings } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import { ACCOUNT_TTL_OPTIONS } from '../../../config';
import {
  selectCanSetPasscode, selectIsCurrentUserFrozen,
  selectIsCurrentUserPremium,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import { getClosestEntry } from '../../../util/getClosestEntry';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
  hasPassword?: boolean;
  hasPasscode?: boolean;
  canSetPasscode?: boolean;
  blockedCount: number;
  webAuthCount: number;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  canDisplayAutoarchiveSetting: boolean;
  shouldArchiveAndMuteNewNonContact?: boolean;
  shouldNewNonContactPeersRequirePremium?: boolean;
  shouldChargeForMessages: boolean;
  canDisplayChatInTitle?: boolean;
  isCurrentUserFrozen?: boolean;
  needAgeVideoVerification?: boolean;
  privacy: GlobalState['settings']['privacy'];
  accountDaysTtl?: number;
};

const DAYS_PER_MONTH = 30;

const SettingsPrivacy: FC<OwnProps & StateProps> = ({
  isActive,
  isCurrentUserPremium,
  hasPassword,
  hasPasscode,
  blockedCount,
  webAuthCount,
  isSensitiveEnabled,
  canChangeSensitive,
  canDisplayAutoarchiveSetting,
  shouldArchiveAndMuteNewNonContact,
  shouldNewNonContactPeersRequirePremium,
  shouldChargeForMessages,
  canDisplayChatInTitle,
  canSetPasscode,
  needAgeVideoVerification,
  privacy,
  onReset,
  isCurrentUserFrozen,
  accountDaysTtl,
}) => {
  const {
    openDeleteAccountModal,
    loadPrivacySettings,
    loadBlockedUsers,
    updateContentSettings,
    loadGlobalPrivacySettings,
    updateGlobalPrivacySettings,
    loadWebAuthorizations,
    setSharedSettingOption,
    openSettingsScreen,
    loadAccountDaysTtl,
    openAgeVerificationModal,
  } = getActions();

  useEffect(() => {
    if (!isCurrentUserFrozen) {
      loadBlockedUsers();
      loadPrivacySettings();
      loadWebAuthorizations();
    }
  }, [isCurrentUserFrozen]);

  useEffect(() => {
    if (isActive && !isCurrentUserFrozen) {
      loadGlobalPrivacySettings();
      loadAccountDaysTtl();
    }
  }, [isActive, isCurrentUserFrozen, loadGlobalPrivacySettings]);

  const oldLang = useOldLang();
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const handleArchiveAndMuteChange = useCallback((isEnabled: boolean) => {
    updateGlobalPrivacySettings({
      shouldArchiveAndMuteNewNonContact: isEnabled,
    });
  }, [updateGlobalPrivacySettings]);

  const handleChatInTitleChange = useCallback((isChecked: boolean) => {
    setSharedSettingOption({
      canDisplayChatInTitle: isChecked,
    });
  }, []);

  const handleUpdateContentSettings = useCallback((isChecked: boolean) => {
    updateContentSettings({ isSensitiveEnabled: isChecked });
  }, [updateContentSettings]);

  const handleAgeVerification = useCallback(() => {
    openAgeVerificationModal();
  }, [openAgeVerificationModal]);

  const handleOpenDeleteAccountModal = useLastCallback(() => {
    if (!accountDaysTtl) return;
    openDeleteAccountModal({ days: accountDaysTtl });
  });

  const dayOption = useMemo(() => {
    if (!accountDaysTtl) return undefined;
    return getClosestEntry(ACCOUNT_TTL_OPTIONS, accountDaysTtl / DAYS_PER_MONTH).toString();
  }, [accountDaysTtl]);

  function getVisibilityValue(setting?: ApiPrivacySettings) {
    if (!setting) return oldLang('Loading');

    const { visibility, shouldAllowPremium, botsPrivacy } = setting;

    const isAllowBots = botsPrivacy === 'allow';
    const isVisibilityEverybody = visibility === 'everybody';
    const shouldShowBotsString = isAllowBots && !isVisibilityEverybody;

    const blockCount = setting.blockChatIds.length + setting.blockUserIds.length;
    const allowCount = setting.allowChatIds.length + setting.allowUserIds.length;
    const total = [];
    if (blockCount) total.push(`-${blockCount}`);
    if (allowCount && !isVisibilityEverybody) total.push(`+${allowCount}`);

    const botPrivacyString = shouldShowBotsString ? lang('PrivacyValueBots') : '';
    const totalString = lang.conjunction(total);

    const exceptionString = [botPrivacyString, totalString].filter(Boolean).join(' ');
    if (shouldShowBotsString && !isVisibilityEverybody) return exceptionString;

    if (shouldAllowPremium) {
      return oldLang(exceptionString ? 'ContactsAndPremium' : 'PrivacyPremium');
    }

    switch (visibility) {
      case 'everybody':
        return `${oldLang('P2PEverybody')} ${exceptionString}`;

      case 'contacts':
        return `${oldLang('P2PContacts')} ${exceptionString}`;

      case 'nobody':
        return `${oldLang('P2PNobody')} ${exceptionString}`;
    }

    return undefined;
  }

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <ListItem
          icon="delete-user"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBlockedUsers })}
        >
          {oldLang('BlockedUsers')}
          <span className="settings-item__current-value">{blockedCount || ''}</span>
        </ListItem>
        {canSetPasscode && (
          <ListItem
            icon="key"
            narrow

            onClick={() => openSettingsScreen({
              screen: hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled,
            })}
          >
            <div className="multiline-item">
              <span className="title">{oldLang('Passcode')}</span>
              <span className="subtitle" dir="auto">
                {oldLang(hasPasscode ? 'PasswordOn' : 'PasswordOff')}
              </span>
            </div>
          </ListItem>
        )}
        <ListItem
          icon="lock"
          narrow

          onClick={() => openSettingsScreen({
            screen: hasPassword ? SettingsScreens.TwoFaEnabled : SettingsScreens.TwoFaDisabled,
          })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('TwoStepVerification')}</span>
            <span className="subtitle" dir="auto">
              {oldLang(hasPassword ? 'PasswordOn' : 'PasswordOff')}
            </span>
          </div>
        </ListItem>
        {webAuthCount > 0 && (
          <ListItem
            icon="web"
            narrow

            onClick={() => openSettingsScreen({ screen: SettingsScreens.ActiveWebsites })}
          >
            {oldLang('PrivacySettings.WebSessions')}
            <span className="settings-item__current-value">{webAuthCount}</span>
          </ListItem>
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{oldLang('PrivacyTitle')}</h4>

        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneNumber })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyPhoneTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.phoneNumber)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyLastSeen })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('LastSeenTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.lastSeen)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyProfilePhoto })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyProfilePhotoTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.profilePhoto)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBio })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyBio')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.bio)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyBirthday })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyBirthday')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.birthday)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyGifts })}
        >
          <div className="multiline-item">
            <span className="title">{lang('PrivacyGifts')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.gifts)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyForwarding })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyForwardsTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.forwards)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyPhoneCall })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('WhoCanCallMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.phoneCall)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          allowDisabledClick
          rightElement={isCurrentUserPremium && <StarIcon size="big" type="premium" />}
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyVoiceMessages })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyVoiceMessagesTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.voiceMessages)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          rightElement={isCurrentUserPremium && <StarIcon size="big" type="premium" />}
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyMessages })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyMessagesTitle')}</span>
            <span className="subtitle" dir="auto">
              {shouldChargeForMessages ? lang('PrivacyPaidMessagesValue')
                : shouldNewNonContactPeersRequirePremium
                  ? oldLang('PrivacyMessagesContactsAndPremium')
                  : oldLang('P2PEverybody')}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"

          onClick={() => openSettingsScreen({ screen: SettingsScreens.PrivacyGroupChats })}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('WhoCanAddMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacy.chatInvite)}
            </span>
          </div>
        </ListItem>
      </div>

      {canChangeSensitive && (
        <div className="settings-item fluid-container">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {oldLang('lng_settings_sensitive_title')}
          </h4>
          <Checkbox
            label={oldLang('lng_settings_sensitive_disable_filtering')}
            subLabel={oldLang('lng_settings_sensitive_about')}
            checked={Boolean(isSensitiveEnabled)}
            disabled={!canChangeSensitive || (!isSensitiveEnabled && needAgeVideoVerification)}
            onCheck={handleUpdateContentSettings}
          />
          {!isSensitiveEnabled && needAgeVideoVerification && (
            <Button
              color="primary"
              fluid
              noForcedUpperCase
              className="settings-unlock-button"
              onClick={handleAgeVerification}
            >
              <span className="settings-unlock-button-title">
                {lang('ButtonAgeVerification')}
              </span>
            </Button>
          )}
        </div>
      )}

      {canDisplayAutoarchiveSetting && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {oldLang('NewChatsFromNonContacts')}
          </h4>
          <Checkbox
            label={oldLang('ArchiveAndMute')}
            subLabel={oldLang('ArchiveAndMuteInfo')}
            checked={Boolean(shouldArchiveAndMuteNewNonContact)}
            onCheck={handleArchiveAndMuteChange}
          />
        </div>
      )}

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {oldLang('lng_settings_window_system')}
        </h4>
        <Checkbox
          label={oldLang('lng_settings_title_chat_name')}
          checked={Boolean(canDisplayChatInTitle)}
          onCheck={handleChatInTitleChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('DeleteMyAccount')}
        </h4>
        <ListItem
          narrow
          onClick={handleOpenDeleteAccountModal}
        >
          {lang('DeleteAccountIfAwayFor')}
          <span className="settings-item__current-value">
            {lang('Months', { count: dayOption }, { pluralValue: 1 })}
          </span>
        </ListItem>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const {
      settings: {
        byKey: {
          hasPassword, isSensitiveEnabled, canChangeSensitive, shouldArchiveAndMuteNewNonContact,
          shouldNewNonContactPeersRequirePremium, nonContactPeersPaidStars,
        },
        privacy,
        accountDaysTtl,
      },
      blocked,
      passcode: {
        hasPasscode,
      },
      appConfig,
    } = global;

    const { canDisplayChatInTitle } = selectSharedSettings(global);
    const shouldChargeForMessages = Boolean(nonContactPeersPaidStars);
    const isCurrentUserFrozen = selectIsCurrentUserFrozen(global);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      isCurrentUserPremium,
      hasPassword,
      hasPasscode: Boolean(hasPasscode),
      blockedCount: blocked.totalCount,
      webAuthCount: global.activeWebSessions.orderedHashes.length,
      isSensitiveEnabled,
      canDisplayAutoarchiveSetting: appConfig.canDisplayAutoarchiveSetting || isCurrentUserPremium,
      shouldArchiveAndMuteNewNonContact,
      canChangeSensitive,
      shouldNewNonContactPeersRequirePremium,
      shouldChargeForMessages,
      needAgeVideoVerification: Boolean(appConfig.needAgeVideoVerification),
      privacy,
      canDisplayChatInTitle,
      canSetPasscode: selectCanSetPasscode(global),
      isCurrentUserFrozen,
      accountDaysTtl,
    };
  },
)(SettingsPrivacy));
