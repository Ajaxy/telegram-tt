import { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiNotifyPeerType, ApiPeerNotifySettings } from '../../../api/types';

import {
  checkIfNotificationsSupported,
  checkIfOfflinePushFailed,
  playNotifySound,
} from '../../../util/notifications';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useRunDebounced from '../../../hooks/useRunDebounced';

import Island, { IslandTitle } from '../../gili/layout/Island';
import Checkbox from '../../ui/Checkbox';
import RangeSlider from '../../ui/RangeSlider';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  notifyDefaults?: Record<ApiNotifyPeerType, ApiPeerNotifySettings>;
  hasContactJoinedNotifications: boolean;
  shouldNotifyAboutPinnedMessages: boolean;
  hasWebNotifications: boolean;
  hasPushNotifications: boolean;
  notificationSoundVolume: number;
};

const SettingsNotifications = ({
  isActive,
  onReset,
  notifyDefaults,
  hasContactJoinedNotifications,
  shouldNotifyAboutPinnedMessages,
  hasPushNotifications,
  hasWebNotifications,
  notificationSoundVolume,
}: OwnProps & StateProps) => {
  const {
    loadNotificationSettings,
    setSettingOption,
    updateContactSignUpNotification,
    updateNotificationSettings,
    updateWebNotificationSettings,
  } = getActions();

  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

  const runDebounced = useRunDebounced(500, true);

  const areNotificationsSupported = checkIfNotificationsSupported();
  const areOfflineNotificationsSupported = areNotificationsSupported && !checkIfOfflinePushFailed();

  const areChannelsMuted = Boolean(notifyDefaults?.channels?.mutedUntil);
  const areGroupsMuted = Boolean(notifyDefaults?.groups?.mutedUntil);
  const areUsersMuted = Boolean(notifyDefaults?.users?.mutedUntil);

  const handleSettingsChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    peerType: ApiNotifyPeerType,
    setting: 'mute' | 'showPreviews',
  ) => {
    const currentIsMuted = Boolean(notifyDefaults?.[peerType]?.mutedUntil);
    const currentShouldShowPreviews = Boolean(notifyDefaults?.[peerType]?.shouldShowPreviews);

    updateNotificationSettings({
      peerType,
      isMuted: setting === 'mute' ? !e.target.checked : currentIsMuted,
      shouldShowPreviews: setting === 'showPreviews' ? e.target.checked : currentShouldShowPreviews,
    });
  }, [notifyDefaults, updateNotificationSettings]);

  const handleWebNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const isEnabled = e.target.checked;
    updateWebNotificationSettings({
      hasWebNotifications: isEnabled,
      hasPushNotifications: isEnabled ? undefined : false,
    });
  }, [updateWebNotificationSettings]);

  const handlePushNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateWebNotificationSettings({
      hasPushNotifications: e.target.checked,
    });
  }, [updateWebNotificationSettings]);

  const handlePrivateChatsNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'users', 'mute');
  }, [handleSettingsChange]);

  const handlePrivateChatsPreviewChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'users', 'showPreviews');
  }, [handleSettingsChange]);

  const handleGroupsNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'groups', 'mute');
  }, [handleSettingsChange]);

  const handleGroupsPreviewChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'groups', 'showPreviews');
  }, [handleSettingsChange]);

  const handleChannelsNotificationsChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'channels', 'mute');
  }, [handleSettingsChange]);

  const handleChannelsPreviewChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleSettingsChange(e, 'channels', 'showPreviews');
  }, [handleSettingsChange]);

  const handleContactNotificationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateContactSignUpNotification({
      isSilent: !e.target.checked,
    });
  }, [updateContactSignUpNotification]);

  const handlePinnedMessagesNotificationChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSettingOption({ shouldNotifyAboutPinnedMessages: e.target.checked });
  }, [setSettingOption]);

  const handleVolumeChange = useCallback((volume: number) => {
    updateWebNotificationSettings({
      notificationSoundVolume: volume,
    });
    runDebounced(() => playNotifySound(undefined, volume));
  }, [runDebounced, updateWebNotificationSettings]);

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  return (
    <div className="settings-content custom-scroll">
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('NotificationsWeb')}
      </IslandTitle>
      <Island>
        <Checkbox
          label={lang('NotificationsWeb')}
          subLabel={lang(hasWebNotifications ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={hasWebNotifications}
          disabled={!areNotificationsSupported}
          onChange={handleWebNotificationsChange}
        />
        <Checkbox
          label={lang('NotificationsOffline')}
          disabled={!hasWebNotifications || !areOfflineNotificationsSupported}
          subLabel={areOfflineNotificationsSupported
            ? lang(hasPushNotifications ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')
            : lang('SettingsOfflineNotificationUnsupported')}
          checked={hasPushNotifications}
          onChange={handlePushNotificationsChange}
        />
        <RangeSlider
          label={lang('NotificationsSound')}
          min={0}
          max={10}
          disabled={!areNotificationsSupported}
          value={notificationSoundVolume}
          onChange={handleVolumeChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>
        {lang('AutodownloadPrivateChats')}
      </IslandTitle>
      <Island>
        <Checkbox
          label={lang('NotificationsForPrivateChats')}
          subLabel={lang(!areUsersMuted ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={!areUsersMuted}
          onChange={handlePrivateChatsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={areUsersMuted}
          subLabel={lang(notifyDefaults?.users?.shouldShowPreviews
            ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={Boolean(notifyDefaults?.users?.shouldShowPreviews)}
          onChange={handlePrivateChatsPreviewChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterGroups')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('NotificationsForGroups')}
          subLabel={lang(!areGroupsMuted ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={!areGroupsMuted}
          onChange={handleGroupsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={areGroupsMuted}
          subLabel={lang(notifyDefaults?.groups?.shouldShowPreviews
            ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={Boolean(notifyDefaults?.groups?.shouldShowPreviews)}
          onChange={handleGroupsPreviewChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterChannels')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('NotificationsForChannels')}
          subLabel={lang(!areChannelsMuted ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={!areChannelsMuted}
          onChange={handleChannelsNotificationsChange}
        />
        <Checkbox
          label={lang('MessagePreview')}
          disabled={areChannelsMuted}
          subLabel={lang(notifyDefaults?.channels?.shouldShowPreviews
            ? 'UserInfoNotificationsEnabled' : 'UserInfoNotificationsDisabled')}
          checked={Boolean(notifyDefaults?.channels?.shouldShowPreviews)}
          onChange={handleChannelsPreviewChange}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('PhoneOther')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('ContactJoined')}
          checked={hasContactJoinedNotifications}
          onChange={handleContactNotificationChange}
        />
        <Checkbox
          label={lang('PinnedMessagesNotifications')}
          checked={shouldNotifyAboutPinnedMessages}
          onChange={handlePinnedMessagesNotificationChange}
        />
      </Island>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      hasContactJoinedNotifications: Boolean(global.settings.byKey.hasContactJoinedNotifications),
      shouldNotifyAboutPinnedMessages: global.settings.byKey.shouldNotifyAboutPinnedMessages,
      hasWebNotifications: global.settings.byKey.hasWebNotifications,
      hasPushNotifications: global.settings.byKey.hasPushNotifications,
      notificationSoundVolume: global.settings.byKey.notificationSoundVolume,
      notifyDefaults: global.settings.notifyDefaults,
    };
  },
)(SettingsNotifications));
