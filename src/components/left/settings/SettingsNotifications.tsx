import { ChangeEvent } from 'react';
import React, {
  FC, memo, useCallback, useEffect,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';

import { pick } from '../../../util/iteratees';
import useLang from '../../../hooks/useLang';

import Checkbox from '../../ui/Checkbox';

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

const SettingsNotifications: FC<StateProps & DispatchProps> = ({
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

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-item">
        <h4 className="settings-item-header">{lang('AutodownloadPrivateChats')}</h4>

        <Checkbox
          label={lang('NotificationsForPrivateChats')}
          subLabel={lang(hasPrivateChatsNotifications ? 'NotificationsEnabled' : 'NotificationsDisabled')}
          checked={hasPrivateChatsNotifications}
          onChange={(e) => { handleSettingsChange(e, 'contact', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          subLabel={lang(hasPrivateChatsMessagePreview ? 'PreviewEnabled' : 'PreviewDisabled')}
          checked={hasPrivateChatsMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'contact', 'showPreviews'); }}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('FilterGroups')}</h4>

        <Checkbox
          label={lang('NotificationsForGroups')}
          subLabel={lang(hasGroupNotifications ? 'NotificationsEnabled' : 'NotificationsDisabled')}
          checked={hasGroupNotifications}
          onChange={(e) => { handleSettingsChange(e, 'group', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          subLabel={lang(hasGroupMessagePreview ? 'PreviewEnabled' : 'PreviewDisabled')}
          checked={hasGroupMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'group', 'showPreviews'); }}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('FilterChannels')}</h4>

        <Checkbox
          label={lang('NotificationsForChannels')}
          subLabel={lang(hasBroadcastNotifications ? 'NotificationsEnabled' : 'NotificationsDisabled')}
          checked={hasBroadcastNotifications}
          onChange={(e) => { handleSettingsChange(e, 'broadcast', 'silent'); }}
        />
        <Checkbox
          label={lang('MessagePreview')}
          subLabel={lang(hasBroadcastMessagePreview ? 'PreviewEnabled' : 'PreviewDisabled')}
          checked={hasBroadcastMessagePreview}
          onChange={(e) => { handleSettingsChange(e, 'broadcast', 'showPreviews'); }}
        />
      </div>

      <div className="settings-item">
        <h4 className="settings-item-header">{lang('PhoneOther')}</h4>

        <Checkbox
          label={lang('ContactJoined')}
          checked={hasContactJoinedNotifications}
          onChange={handleContactNotificationChange}
        />
      </div>
    </div>
  );
};

export default memo(withGlobal((global): StateProps => {
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
