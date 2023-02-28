import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPrivacySettings } from '../../../types';
import { SettingsScreens } from '../../../types';

import { selectIsCurrentUserPremium } from '../../../global/selectors';

import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import Checkbox from '../../ui/Checkbox';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  isCurrentUserPremium?: boolean;
  hasPassword?: boolean;
  hasPasscode?: boolean;
  blockedCount: number;
  webAuthCount: number;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  canDisplayAutoarchiveSetting: boolean;
  shouldArchiveAndMuteNewNonContact?: boolean;
  privacyPhoneNumber?: ApiPrivacySettings;
  privacyLastSeen?: ApiPrivacySettings;
  privacyProfilePhoto?: ApiPrivacySettings;
  privacyForwarding?: ApiPrivacySettings;
  privacyVoiceMessages?: ApiPrivacySettings;
  privacyGroupChats?: ApiPrivacySettings;
  privacyPhoneCall?: ApiPrivacySettings;
  privacyPhoneP2P?: ApiPrivacySettings;
};

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
  privacyPhoneNumber,
  privacyLastSeen,
  privacyProfilePhoto,
  privacyForwarding,
  privacyVoiceMessages,
  privacyGroupChats,
  privacyPhoneCall,
  privacyPhoneP2P,
  onScreenSelect,
  onReset,
}) => {
  const {
    loadPrivacySettings,
    loadBlockedContacts,
    loadAuthorizations,
    loadContentSettings,
    updateContentSettings,
    loadGlobalPrivacySettings,
    updateGlobalPrivacySettings,
    loadWebAuthorizations,
    showNotification,
  } = getActions();

  useEffect(() => {
    loadBlockedContacts();
    loadAuthorizations();
    loadPrivacySettings();
    loadContentSettings();
    loadWebAuthorizations();
  }, [loadBlockedContacts, loadAuthorizations, loadPrivacySettings, loadContentSettings, loadWebAuthorizations]);

  useEffect(() => {
    if (isActive) {
      loadGlobalPrivacySettings();
    }
  }, [isActive, loadGlobalPrivacySettings]);

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

  const handleVoiceMessagesClick = useCallback(() => {
    if (isCurrentUserPremium) {
      onScreenSelect(SettingsScreens.PrivacyVoiceMessages);
    } else {
      showNotification({
        message: lang('PrivacyVoiceMessagesPremiumOnly'),
      });
    }
  }, [isCurrentUserPremium, lang, onScreenSelect, showNotification]);

  const handleUpdateContentSettings = useCallback((isChecked: boolean) => {
    updateContentSettings(isChecked);
  }, [updateContentSettings]);

  function getVisibilityValue(setting?: ApiPrivacySettings) {
    const { visibility } = setting || {};
    const blockCount = setting ? setting.blockChatIds.length + setting.blockUserIds.length : 0;
    const allowCount = setting ? setting.allowChatIds.length + setting.allowUserIds.length : 0;
    const total = [];
    if (blockCount) total.push(`-${blockCount}`);
    if (allowCount) total.push(`+${allowCount}`);

    const exceptionString = total.length ? `(${total.join(',')})` : '';

    switch (visibility) {
      case 'everybody':
        return `${lang('P2PEverybody')} ${exceptionString}`;

      case 'contacts':
        return `${lang('P2PContacts')} ${exceptionString}`;

      case 'nobody':
        return `${lang('P2PNobody')} ${exceptionString}`;
    }

    return undefined;
  }

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item pt-3">
        <ListItem
          icon="delete-user"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyBlockedUsers)}
        >
          {lang('BlockedUsers')}
          <span className="settings-item__current-value">{blockedCount || ''}</span>
        </ListItem>
        <ListItem
          icon="key"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(
            hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled,
          )}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('Passcode')}</span>
            <span className="subtitle" dir="auto">
              {lang(hasPasscode ? 'PasswordOn' : 'PasswordOff')}
            </span>
          </div>
        </ListItem>
        <ListItem
          icon="lock"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(
            hasPassword ? SettingsScreens.TwoFaEnabled : SettingsScreens.TwoFaDisabled,
          )}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('TwoStepVerification')}</span>
            <span className="subtitle" dir="auto">
              {lang(hasPassword ? 'PasswordOn' : 'PasswordOff')}
            </span>
          </div>
        </ListItem>
        {webAuthCount > 0 && (
          <ListItem
            icon="web"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => onScreenSelect(SettingsScreens.ActiveWebsites)}
          >
            {lang('PrivacySettings.WebSessions')}
            <span className="settings-item__current-value">{webAuthCount}</span>
          </ListItem>
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>{lang('PrivacyTitle')}</h4>

        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneNumber)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyPhoneTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyPhoneNumber)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyLastSeen)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('LastSeenTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyLastSeen)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyProfilePhoto)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyProfilePhotoTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyProfilePhoto)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneCall)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('WhoCanCallMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyPhoneCall)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneP2P)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyP2P')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyPhoneP2P)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyForwarding)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyForwardsTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyForwarding)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          disabled={!isCurrentUserPremium}
          allowDisabledClick
          rightElement={!isCurrentUserPremium && <i className="icon-lock-badge settings-icon-locked" />}
          className="no-icon"
          onClick={handleVoiceMessagesClick}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyVoiceMessages')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyVoiceMessages)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyGroupChats)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('WhoCanAddMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(privacyGroupChats)}
            </span>
          </div>
        </ListItem>
      </div>

      {canDisplayAutoarchiveSetting && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('NewChatsFromNonContacts')}
          </h4>
          <Checkbox
            label={lang('ArchiveAndMute')}
            subLabel={lang('ArchiveAndMuteInfo')}
            checked={Boolean(shouldArchiveAndMuteNewNonContact)}
            onCheck={handleArchiveAndMuteChange}
          />
        </div>
      )}

      {canChangeSensitive && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
            {lang('lng_settings_sensitive_title')}
          </h4>
          <Checkbox
            label={lang('lng_settings_sensitive_disable_filtering')}
            subLabel={lang('lng_settings_sensitive_about')}
            checked={Boolean(isSensitiveEnabled)}
            disabled={!canChangeSensitive}
            onCheck={handleUpdateContentSettings}
          />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      settings: {
        byKey: {
          hasPassword, isSensitiveEnabled, canChangeSensitive, shouldArchiveAndMuteNewNonContact,
        },
        privacy,
      },
      blocked,
      passcode: {
        hasPasscode,
      },
      appConfig,
    } = global;

    return {
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      hasPassword,
      hasPasscode: Boolean(hasPasscode),
      blockedCount: blocked.totalCount,
      webAuthCount: global.activeWebSessions.orderedHashes.length,
      isSensitiveEnabled,
      canDisplayAutoarchiveSetting: Boolean(appConfig?.canDisplayAutoarchiveSetting),
      shouldArchiveAndMuteNewNonContact,
      canChangeSensitive,
      privacyPhoneNumber: privacy.phoneNumber,
      privacyLastSeen: privacy.lastSeen,
      privacyProfilePhoto: privacy.profilePhoto,
      privacyForwarding: privacy.forwards,
      privacyVoiceMessages: privacy.voiceMessages,
      privacyGroupChats: privacy.chatInvite,
      privacyPhoneCall: privacy.phoneCall,
      privacyPhoneP2P: privacy.phoneP2P,
    };
  },
)(SettingsPrivacy));
