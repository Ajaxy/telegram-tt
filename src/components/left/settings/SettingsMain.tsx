import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens } from '../../../types';

import { FAQ_URL, PRIVACY_URL } from '../../../config';
import { selectIsPremiumPurchaseBlocked } from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ChatExtra from '../../common/ChatExtra';
import PremiumIcon from '../../common/PremiumIcon';
import ProfileInfo from '../../common/ProfileInfo';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';

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
    openPremiumModal,
    openSupportChat,
    openUrl,
  } = getActions();

  const [isSupportDialogOpen, openSupportDialog, closeSupportDialog] = useFlag(false);

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

  const handleOpenSupport = useLastCallback(() => {
    openSupportChat();
    closeSupportDialog();
  });

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
      </div>
      <div className="settings-main-menu">
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
      <div className="settings-main-menu">
        <ListItem
          icon="ask-support"
          onClick={openSupportDialog}
        >
          {lang('AskAQuestion')}
        </ListItem>
        <ListItem
          icon="help"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => openUrl({ url: FAQ_URL })}
        >
          {lang('TelegramFaq')}
        </ListItem>
        <ListItem
          icon="privacy-policy"
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => openUrl({ url: PRIVACY_URL })}
        >
          {lang('PrivacyPolicy')}
        </ListItem>
      </div>
      <ConfirmDialog
        isOpen={isSupportDialogOpen}
        confirmLabel={lang('lng_settings_ask_ok')}
        title={lang('AskAQuestion')}
        text={lang('lng_settings_ask_sure')}
        confirmHandler={handleOpenSupport}
        onClose={closeSupportDialog}
      />
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
