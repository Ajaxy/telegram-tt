import { ChangeEvent } from 'react';
import useDebounce from '../../../hooks/useDebounce';
import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens } from '../../../types';

import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';
import { playNotifySound } from '../../../util/notifications';

import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  hasPrivateChatsNotifications: boolean;
  hasPrivateChatsMessagePreview: boolean;
  hasGroupNotifications: boolean;
  hasGroupMessagePreview: boolean;
  hasBroadcastNotifications: boolean;
  hasBroadcastMessagePreview: boolean;
  hasContactJoinedNotifications: boolean;
  hasWebNotifications: boolean;
  hasPushNotifications: boolean;
  notificationSoundVolume: number;
};

const SettingsNotifications: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  hasPrivateChatsNotifications,
  hasPrivateChatsMessagePreview,
  hasGroupNotifications,
  hasGroupMessagePreview,
  hasBroadcastNotifications,
  hasBroadcastMessagePreview,
  hasContactJoinedNotifications,
  hasPushNotifications,
  hasWebNotifications,
  notificationSoundVolume,
}) => {
  const {
    loadNotificationSettings,
    updateContactSignUpNotification,
    updateNotificationSettings,
    updateWebNotificationSettings,
  } = getActions();

  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

  const runDebounced = useDebounce(500, true);

  const handleSettingsChange = useCallback((
    e: ChangeEvent<HTMLInputElement>,
    peerType: 'contact' | 'group' | 'broadcast',
    setting: 'silent' | 'showPreviews',
  ) => {
    const currentIsSilent = peerType === 'contact'
      ? !hasPrivateChatsNotifications
      : !(peerType === 'group' ? hasGroupNotifications : hasBroadcastNotifications);
    const currentShouldShowPreviews = peerType === 'contact'
      ? hasPrivateChatsMessagePreview
      : (peerType === 'group' ? hasGroupMessagePreview : hasBroadcastMessagePreview);

    updateNotificationSettings({
      peerType,
      ...(setting === 'silent' && { isSilent: !e.target.checked, shouldShowPreviews: currentShouldShowPreviews }),
      ...(setting === 'showPreviews' && { shouldShowPreviews: e.target.checked, isSilent: currentIsSilent }),
    });
  }, [
    hasBroadcastMessagePreview, hasBroadcastNotifications,
    hasGroupMessagePreview, hasGroupNotifications,
    hasPrivateChatsMessagePreview, hasPrivateChatsNotifications,
    updateNotificationSettings,
  ]);

  const handleWebNotificationsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    updateWebNotificationSettings({
      hasWebNotifications: e.target.checked,
    });
  }, [updateWebNotificationSettings]);

  const handlePushNotificationsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    updateWebNotificationSettings({
      hasPushNotifications: e.target.checked,
    });
  }, [updateWebNotificationSettings]);

  const handlePrivateChatsNotificationsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'contact', 'silent');
  }, [handleSettingsChange]);

  const handlePrivateChatsPreviewChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'contact', 'showPreviews');
  }, [handleSettingsChange]);

  const handleGroupsNotificationsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'group', 'silent');
  }, [handleSettingsChange]);

  const handleGroupsPreviewChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'group', 'showPreviews');
  }, [handleSettingsChange]);

  const handleChannelsNotificationsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'broadcast', 'silent');
  }, [handleSettingsChange]);

  const handleChannelsPreviewChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'broadcast', 'showPreviews');
  }, [handleSettingsChange]);

  const handleContactNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    updateContactSignUpNotification({
      isSilent: !e.target.checked,
    });
  }, [updateContactSignUpNotification]);

  const handleVolumeChange = useCallback((volume: number) => {
    updateWebNotificationSettings({
      notificationSoundVolume: volume,
    });
    runDebounced(() => playNotifySound(undefined, volume));
  }, [runDebounced, updateWebNotificationSettings]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Notifications);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          Web notifications
        </h4>
        <Checkbox
          label="Web notifications"
          // eslint-disable-next-line max-len
          subLabel={lang(hasWebNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasWebNotifications}
          onChange={handleWebNotificationsChange}
        />
        <Checkbox
          label="Offline notifications"
          disabled={!hasWebNotifications}
          // eslint-disable-next-line max-len
          subLabel={lang(hasPushNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasPushNotifications}
          onChange={handlePushNotificationsChange}
        />
        <div className="settings-item-slider">
          <RangeSlider
            label="Sound"
            min={0}
            max={10}
            value={notificationSoundVolume}
            onChange={handleVolumeChange}
          />
        </div>
      </div>
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('AutodownloadPrivateChats')}
        </h4>

        <Checkbox
          label={lang('NotificationsForPrivateChats')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasPrivateChatsNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasPrivateChatsNotifications}
          onChange={handlePrivateChatsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={!hasPrivateChatsNotifications}
          // eslint-disable-next-line max-len
          subLabel={lang(hasPrivateChatsMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasPrivateChatsMessagePreview}
          onChange={handlePrivateChatsPreviewChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterGroups')}</h4>

        <Checkbox
          label={lang('NotificationsForGroups')}
          subLabel={lang(hasGroupNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasGroupNotifications}
          onChange={handleGroupsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={!hasGroupNotifications}
          subLabel={lang(hasGroupMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasGroupMessagePreview}
          onChange={handleGroupsPreviewChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterChannels')}</h4>

        <Checkbox
          label={lang('NotificationsForChannels')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasBroadcastNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasBroadcastNotifications}
          onChange={handleChannelsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={!hasBroadcastNotifications}
          // eslint-disable-next-line max-len
          subLabel={lang(hasBroadcastMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasBroadcastMessagePreview}
          onChange={handleChannelsPreviewChange}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('PhoneOther')}</h4>

        <Checkbox
          label={lang('ContactJoined')}
          checked={hasContactJoinedNotifications}
          onChange={handleContactNotificationChange}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      hasPrivateChatsNotifications: Boolean(global.settings.byKey.hasPrivateChatsNotifications),
      hasPrivateChatsMessagePreview: Boolean(global.settings.byKey.hasPrivateChatsMessagePreview),
      hasGroupNotifications: Boolean(global.settings.byKey.hasGroupNotifications),
      hasGroupMessagePreview: Boolean(global.settings.byKey.hasGroupMessagePreview),
      hasBroadcastNotifications: Boolean(global.settings.byKey.hasBroadcastNotifications),
      hasBroadcastMessagePreview: Boolean(global.settings.byKey.hasBroadcastMessagePreview),
      hasContactJoinedNotifications: Boolean(global.settings.byKey.hasContactJoinedNotifications),
      hasWebNotifications: global.settings.byKey.hasWebNotifications,
      hasPushNotifications: global.settings.byKey.hasPushNotifications,
      notificationSoundVolume: global.settings.byKey.notificationSoundVolume,
    };
  },
)(SettingsNotifications));
