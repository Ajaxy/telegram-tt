import type { FC } from '../../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPrivacySettings } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import { selectCanSetPasscode, selectIsCurrentUserPremium } from '../../../global/selectors';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import Checkbox from '../../ui/Checkbox';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
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
  canDisplayChatInTitle?: boolean;
  privacy: GlobalState['settings']['privacy'];
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
  shouldNewNonContactPeersRequirePremium,
  canDisplayChatInTitle,
  canSetPasscode,
  privacy,
  onScreenSelect,
  onReset,
}) => {
  const {
    loadPrivacySettings,
    loadBlockedUsers,
    loadContentSettings,
    updateContentSettings,
    loadGlobalPrivacySettings,
    updateGlobalPrivacySettings,
    loadWebAuthorizations,
    setSettingOption,
  } = getActions();

  useEffect(() => {
    loadBlockedUsers();
    loadPrivacySettings();
    loadContentSettings();
    loadWebAuthorizations();
  }, []);

  useEffect(() => {
    if (isActive) {
      loadGlobalPrivacySettings();
    }
  }, [isActive, loadGlobalPrivacySettings]);

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
    setSettingOption({
      canDisplayChatInTitle: isChecked,
    });
  }, []);

  const handleUpdateContentSettings = useCallback((isChecked: boolean) => {
    updateContentSettings(isChecked);
  }, [updateContentSettings]);

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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyBlockedUsers)}
        >
          {oldLang('BlockedUsers')}
          <span className="settings-item__current-value">{blockedCount || ''}</span>
        </ListItem>
        {canSetPasscode && (
          <ListItem
            icon="key"
            narrow
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => onScreenSelect(
              hasPasscode ? SettingsScreens.PasscodeEnabled : SettingsScreens.PasscodeDisabled,
            )}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(
            hasPassword ? SettingsScreens.TwoFaEnabled : SettingsScreens.TwoFaDisabled,
          )}
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
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => onScreenSelect(SettingsScreens.ActiveWebsites)}
          >
            {oldLang('PrivacySettings.WebSessions')}
            <span className="settings-item__current-value">{webAuthCount}</span>
          </ListItem>
        )}
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>{oldLang('PrivacyTitle')}</h4>

        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneNumber)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyLastSeen)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyProfilePhoto)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyBio)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyBirthday)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyGifts)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyForwarding)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyPhoneCall)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyVoiceMessages)}
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
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyMessages)}
        >
          <div className="multiline-item">
            <span className="title">{oldLang('PrivacyMessagesTitle')}</span>
            <span className="subtitle" dir="auto">
              {shouldNewNonContactPeersRequirePremium
                ? oldLang('PrivacyMessagesContactsAndPremium')
                : oldLang('P2PEverybody')}
            </span>
          </div>
        </ListItem>
        <ListItem
          narrow
          className="no-icon"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.PrivacyGroupChats)}
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
        <div className="settings-item">
          <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>
            {oldLang('lng_settings_sensitive_title')}
          </h4>
          <Checkbox
            label={oldLang('lng_settings_sensitive_disable_filtering')}
            subLabel={oldLang('lng_settings_sensitive_about')}
            checked={Boolean(isSensitiveEnabled)}
            disabled={!canChangeSensitive}
            onCheck={handleUpdateContentSettings}
          />
        </div>
      )}

      {canDisplayAutoarchiveSetting && (
        <div className="settings-item">
          <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>
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
        <h4 className="settings-item-header" dir={oldLang.isRtl ? 'rtl' : undefined}>
          {oldLang('lng_settings_window_system')}
        </h4>
        <Checkbox
          label={oldLang('lng_settings_title_chat_name')}
          checked={Boolean(canDisplayChatInTitle)}
          onCheck={handleChatInTitleChange}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      settings: {
        byKey: {
          hasPassword, isSensitiveEnabled, canChangeSensitive, shouldArchiveAndMuteNewNonContact,
          canDisplayChatInTitle, shouldNewNonContactPeersRequirePremium,
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
      shouldNewNonContactPeersRequirePremium,
      privacy,
      canDisplayChatInTitle,
      canSetPasscode: selectCanSetPasscode(global),
    };
  },
)(SettingsPrivacy));
