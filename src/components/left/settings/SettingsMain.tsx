import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import { SettingsScreens } from '../../../types';

import { selectIsPremiumPurchaseBlocked } from '../../../global/selectors';
import useLang from '../../../hooks/useLang';
import useHistoryBack from '../../../hooks/useHistoryBack';

import ListItem from '../../ui/ListItem';
import ProfileInfo from '../../common/ProfileInfo';
import ChatExtra from '../../common/ChatExtra';
import PremiumIcon from '../../common/PremiumIcon';

type OwnProps = {
  isActive?: boolean;
  onScreenSelect: (screen: SettingsScreens) => void;
  onReset: () => void;
};

type StateProps = {
  sessionCount: number;
  currentUserId?: string;
  canBuyPremium?: boolean;
};

const SettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  onScreenSelect,
  onReset,
  currentUserId,
  sessionCount,
  canBuyPremium,
}) => {
  const {
    loadProfilePhotos,
    loadAuthorizations,
    openPremiumModal,
  } = getActions();

  const lang = useLang();

  useEffect(() => {
    if (currentUserId) {
      loadProfilePhotos({ profileId: currentUserId });
    }
  }, [currentUserId, loadProfilePhotos]);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  useEffect(() => {
    loadAuthorizations();
  }, []);

  return (
    <div className="settings-content custom-scroll">
      <div className="settings-main-menu">
        {currentUserId && (
          <ProfileInfo
            userId={currentUserId}
            canPlayVideo={Boolean(isActive)}
            forceShowSelf
          />
        )}
        {currentUserId && (
          <ChatExtra
            chatOrUserId={currentUserId}
            forceShowSelf
          />
        )}
        <ListItem
          icon="settings"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.General)}
        >
          {lang('Telegram.GeneralSettingsViewController')}
        </ListItem>
        <ListItem
          icon="animations"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Performance)}
        >
          {lang('Animations and Performance')}
        </ListItem>
        <ListItem
          icon="unmute"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Notifications)}
        >
          {lang('Notifications')}
        </ListItem>
        <ListItem
          icon="data"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.DataStorage)}
        >
          {lang('DataSettings')}
        </ListItem>
        <ListItem
          icon="lock"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Privacy)}
        >
          {lang('PrivacySettings')}
        </ListItem>
        <ListItem
          icon="folder"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Folders)}
        >
          {lang('Filters')}
        </ListItem>
        <ListItem
          icon="active-sessions"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.ActiveSessions)}
        >
          {lang('SessionsTitle')}
          {sessionCount > 0 && (<span className="settings-item__current-value">{sessionCount}</span>)}
        </ListItem>
        <ListItem
          icon="language"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Language)}
        >
          {lang('Language')}
          <span className="settings-item__current-value">{lang.langName}</span>
        </ListItem>
        <ListItem
          icon="stickers"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Stickers)}
        >
          {lang('StickersName')}
        </ListItem>
        {canBuyPremium && (
          <ListItem
            leftElement={<PremiumIcon withGradient big />}
            className="settings-main-menu-premium"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openPremiumModal()}
          >
            {lang('TelegramPremium')}
          </ListItem>
        )}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;

    return {
      sessionCount: global.activeSessions.orderedHashes.length,
      currentUserId,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
    };
  },
)(SettingsMain));
