import { ChangeEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { SettingsScreens } from '../../../types';

import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import Checkbox from '../../ui/Checkbox';

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
};

type DispatchProps = Pick<GlobalActions, (
  'loadNotificationSettings' | 'updateContactSignUpNotification' | 'updateNotificationSettings'
)>;

const SettingsNotifications: FC<OwnProps & StateProps & DispatchProps> = ({
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
  loadNotificationSettings,
  updateContactSignUpNotification,
  updateNotificationSettings,
}) => {
  useEffect(() => {
    loadNotificationSettings();
  }, [loadNotificationSettings]);

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

  const handleContactNotificationChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    updateContactSignUpNotification({
      isSilent: !e.target.checked,
    });
  }, [updateContactSignUpNotification]);

  const lang = useLang();

  useHistoryBack(isActive, onReset, onScreenSelect, SettingsScreens.Notifications);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>
          {lang('AutodownloadPrivateChats')}
        </h4>

        <Checkbox
          label={lang('NotificationsForPrivateChats')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasPrivateChatsNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasPrivateChatsNotifications}
          onChange={(e) => { handleSettingsChange(e, 'contact', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasPrivateChatsMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasPrivateChatsMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'contact', 'showPreviews'); }}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterGroups')}</h4>

        <Checkbox
          label={lang('NotificationsForGroups')}
          subLabel={lang(hasGroupNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasGroupNotifications}
          onChange={(e) => { handleSettingsChange(e, 'group', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          subLabel={lang(hasGroupMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasGroupMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'group', 'showPreviews'); }}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header" dir={lang.isRtl ? 'rtl' : undefined}>{lang('FilterChannels')}</h4>

        <Checkbox
          label={lang('NotificationsForChannels')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasBroadcastNotifications ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasBroadcastNotifications}
          onChange={(e) => { handleSettingsChange(e, 'broadcast', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          // eslint-disable-next-line max-len
          subLabel={lang(hasBroadcastMessagePreview ? 'UserInfo.NotificationsEnabled' : 'UserInfo.NotificationsDisabled')}
          checked={hasBroadcastMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'broadcast', 'showPreviews'); }}
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

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    hasPrivateChatsNotifications: Boolean(global.settings.byKey.hasPrivateChatsNotifications),
    hasPrivateChatsMessagePreview: Boolean(global.settings.byKey.hasPrivateChatsMessagePreview),
    hasGroupNotifications: Boolean(global.settings.byKey.hasGroupNotifications),
    hasGroupMessagePreview: Boolean(global.settings.byKey.hasGroupMessagePreview),
    hasBroadcastNotifications: Boolean(global.settings.byKey.hasBroadcastNotifications),
    hasBroadcastMessagePreview: Boolean(global.settings.byKey.hasBroadcastMessagePreview),
    hasContactJoinedNotifications: Boolean(global.settings.byKey.hasContactJoinedNotifications),
  };
},
(setGlobal, actions): DispatchProps => pick(actions, [
  'loadNotificationSettings',
  'updateContactSignUpNotification',
  'updateNotificationSettings',
]))(SettingsNotifications));
