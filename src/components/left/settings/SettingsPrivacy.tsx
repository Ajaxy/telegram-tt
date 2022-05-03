import React, { FC, memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiPrivacySettings, SettingsScreens } from '../../../types';

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
  hasPassword?: boolean;
  blockedCount: number;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  privacyPhoneNumber?: ApiPrivacySettings;
  privacyLastSeen?: ApiPrivacySettings;
  privacyProfilePhoto?: ApiPrivacySettings;
  privacyForwarding?: ApiPrivacySettings;
  privacyGroupChats?: ApiPrivacySettings;
  privacyPhoneCall?: ApiPrivacySettings;
  privacyPhoneP2P?: ApiPrivacySettings;
};

const SettingsPrivacy: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  hasPassword,
  blockedCount,
  isSensitiveEnabled,
  canChangeSensitive,
  privacyPhoneNumber,
  privacyLastSeen,
  privacyProfilePhoto,
  privacyForwarding,
  privacyGroupChats,
  privacyPhoneCall,
  privacyPhoneP2P,

}) => {
  const {
    loadPrivacySettings,
    loadBlockedContacts,
    loadAuthorizations,
    loadContentSettings,
    updateContentSettings,
  } = getActions();

  useEffect(() => {
    loadBlockedContacts();
    loadAuthorizations();
    loadPrivacySettings();
    loadContentSettings();
  }, [loadBlockedContacts, loadAuthorizations, loadPrivacySettings, loadContentSettings]);

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

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
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyBlockedUsers)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('BlockedUsers')}</span>
            {blockedCount > 0 && (
              <span className="subtitle" dir="auto">
                {lang('Users', blockedCount)}
              </span>
            )}
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
            onCheck={updateContentSettings}
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
        byKey: { hasPassword, isSensitiveEnabled, canChangeSensitive },
        privacy,
      },
      blocked,
    } = global;

    return {
      hasPassword,
      blockedCount: blocked.totalCount,
      isSensitiveEnabled,
      canChangeSensitive,
      privacyPhoneNumber: privacy.phoneNumber,
      privacyLastSeen: privacy.lastSeen,
      privacyProfilePhoto: privacy.profilePhoto,
      privacyForwarding: privacy.forwards,
      privacyGroupChats: privacy.chatInvite,
      privacyPhoneCall: privacy.phoneCall,
      privacyPhoneP2P: privacy.phoneP2P,
    };
  },
)(SettingsPrivacy));
