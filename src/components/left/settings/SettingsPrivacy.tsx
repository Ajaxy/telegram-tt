import React, { FC, memo, useEffect } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { PrivacyVisibility, SettingsScreens } from '../../../types';

import { pick } from '../../../util/iteratees';
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
  sessionsCount: number;
  isSensitiveEnabled?: boolean;
  canChangeSensitive?: boolean;
  visibilityPrivacyPhoneNumber?: PrivacyVisibility;
  visibilityPrivacyLastSeen?: PrivacyVisibility;
  visibilityPrivacyProfilePhoto?: PrivacyVisibility;
  visibilityPrivacyForwarding?: PrivacyVisibility;
  visibilityPrivacyGroupChats?: PrivacyVisibility;
};

type DispatchProps = Pick<GlobalActions, (
  'loadBlockedContacts' | 'loadAuthorizations' | 'loadPrivacySettings' | 'loadContentSettings' | 'updateContentSettings'
)>;

const SettingsPrivacy: FC<OwnProps & StateProps & DispatchProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  hasPassword,
  blockedCount,
  sessionsCount,
  isSensitiveEnabled,
  canChangeSensitive,
  visibilityPrivacyPhoneNumber,
  visibilityPrivacyLastSeen,
  visibilityPrivacyProfilePhoto,
  visibilityPrivacyForwarding,
  visibilityPrivacyGroupChats,
  loadPrivacySettings,
  loadBlockedContacts,
  loadAuthorizations,
  loadContentSettings,
  updateContentSettings,
}) => {
  useEffect(() => {
    loadBlockedContacts();
    loadAuthorizations();
    loadPrivacySettings();
    loadContentSettings();
  }, [loadBlockedContacts, loadAuthorizations, loadPrivacySettings, loadContentSettings]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Privacy);

  function getVisibilityValue(visibility?: PrivacyVisibility) {
    switch (visibility) {
      case 'everybody':
        return lang('P2PEverybody');

      case 'contacts':
        return lang('P2PContacts');

      case 'nobody':
        return lang('P2PNobody');
    }

    return undefined;
  }

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item pt-3">
        <ListItem
          icon="delete-user"
          narrow
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
        <ListItem
          icon="active-sessions"
          narrow
          onClick={() => onScreenSelect(SettingsScreens.PrivacyActiveSessions)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('SessionsTitle')}</span>
            {sessionsCount > 0 && (
              <span className="subtitle" dir="auto">
                {sessionsCount === 1 ? '1 session' : `${sessionsCount} sessions`}
              </span>
            )}
          </div>
        </ListItem>
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header mb-4" dir={lang.isRtl ? 'rtl' : undefined}>{lang('PrivacyTitle')}</h4>

        <ListItem
          narrow
          className="no-icon"
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneNumber)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyPhoneTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(visibilityPrivacyPhoneNumber)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => onScreenSelect(SettingsScreens.PrivacyLastSeen)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('LastSeenTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(visibilityPrivacyLastSeen)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => onScreenSelect(SettingsScreens.PrivacyProfilePhoto)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyProfilePhotoTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(visibilityPrivacyProfilePhoto)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => onScreenSelect(SettingsScreens.PrivacyForwarding)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('PrivacyForwardsTitle')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(visibilityPrivacyForwarding)}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          onClick={() => onScreenSelect(SettingsScreens.PrivacyGroupChats)}
        >
          <div className="multiline-menu-item">
            <span className="title">{lang('WhoCanAddMe')}</span>
            <span className="subtitle" dir="auto">
              {getVisibilityValue(visibilityPrivacyGroupChats)}
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
      activeSessions,
    } = global;

    return {
      hasPassword,
      blockedCount: blocked.totalCount,
      sessionsCount: activeSessions.length,
      isSensitiveEnabled,
      canChangeSensitive,
      visibilityPrivacyPhoneNumber: privacy.phoneNumber?.visibility,
      visibilityPrivacyLastSeen: privacy.lastSeen?.visibility,
      visibilityPrivacyProfilePhoto: privacy.profilePhoto?.visibility,
      visibilityPrivacyForwarding: privacy.forwards?.visibility,
      visibilityPrivacyGroupChats: privacy.chatInvite?.visibility,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadBlockedContacts', 'loadAuthorizations', 'loadPrivacySettings', 'loadContentSettings', 'updateContentSettings',
  ]),
)(SettingsPrivacy));
