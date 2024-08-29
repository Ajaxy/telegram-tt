import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { SettingsScreens } from '../../../types';

import { FAQ_URL, PRIVACY_URL } from '../../../config';
import {
  selectIsGiveawayGiftsPurchaseAvailable,
  selectIsPremiumPurchaseBlocked,
} from '../../../global/selectors';
import { formatInteger } from '../../../util/textFormat';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import StarIcon from '../../common/icons/StarIcon';
import ChatExtra from '../../common/profile/ChatExtra';
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
  isGiveawayAvailable?: boolean;
  starsBalance?: number;
  shouldDisplayStars?: boolean;
};

const SettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  currentUserId,
  sessionCount,
  canBuyPremium,
  isGiveawayAvailable,
  starsBalance,
  shouldDisplayStars,
  onScreenSelect,
  onReset,
}) => {
  const {
    loadMoreProfilePhotos,
    openPremiumModal,
    openSupportChat,
    openUrl,
    openPremiumGiftingModal,
    openStarsBalanceModal,
  } = getActions();

  const [isSupportDialogOpen, openSupportDialog, closeSupportDialog] = useFlag(false);

  const oldLang = useOldLang();

  useEffect(() => {
    if (currentUserId) {
      loadMoreProfilePhotos({ peerId: currentUserId, isPreload: true });
    }
  }, [currentUserId]);

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
            peerId={currentUserId}
            canPlayVideo={Boolean(isActive)}
            forceShowSelf
          />
        )}
        {currentUserId && (
          <ChatExtra
            chatOrUserId={currentUserId}
            isInSettings
          />
        )}
        <ListItem
          icon="settings"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.General)}
        >
          {oldLang('Telegram.GeneralSettingsViewController')}
        </ListItem>
        <ListItem
          icon="animations"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Performance)}
        >
          {oldLang('Animations and Performance')}
        </ListItem>
        <ListItem
          icon="unmute"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Notifications)}
        >
          {oldLang('Notifications')}
        </ListItem>
        <ListItem
          icon="data"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.DataStorage)}
        >
          {oldLang('DataSettings')}
        </ListItem>
        <ListItem
          icon="lock"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Privacy)}
        >
          {oldLang('PrivacySettings')}
        </ListItem>
        <ListItem
          icon="folder"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Folders)}
        >
          {oldLang('Filters')}
        </ListItem>
        <ListItem
          icon="active-sessions"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.ActiveSessions)}
        >
          {oldLang('SessionsTitle')}
          {sessionCount > 0 && (<span className="settings-item__current-value">{sessionCount}</span>)}
        </ListItem>
        <ListItem
          icon="language"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Language)}
        >
          {oldLang('Language')}
          <span className="settings-item__current-value">{oldLang.langName}</span>
        </ListItem>
        <ListItem
          icon="stickers"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => onScreenSelect(SettingsScreens.Stickers)}
        >
          {oldLang('StickersName')}
        </ListItem>
      </div>
      <div className="settings-main-menu">
        {canBuyPremium && (
          <ListItem
            leftElement={<StarIcon className="icon ListItem-main-icon" type="premium" size="big" />}
            narrow
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openPremiumModal()}
          >
            {oldLang('TelegramPremium')}
          </ListItem>
        )}
        {shouldDisplayStars && (
          <ListItem
            leftElement={<StarIcon className="icon ListItem-main-icon" type="gold" size="big" />}
            narrow
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openStarsBalanceModal({})}
          >
            {oldLang('MenuTelegramStars')}
            {Boolean(starsBalance) && (
              <span className="settings-item__current-value">{formatInteger(starsBalance)}</span>
            )}
          </ListItem>
        )}
        {isGiveawayAvailable && (
          <ListItem
            icon="gift"
            narrow
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openPremiumGiftingModal()}
          >
            {oldLang('GiftPremiumGifting')}
          </ListItem>
        )}
      </div>
      <div className="settings-main-menu">
        <ListItem
          icon="ask-support"
          narrow
          onClick={openSupportDialog}
        >
          {oldLang('AskAQuestion')}
        </ListItem>
        <ListItem
          icon="help"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => openUrl({ url: FAQ_URL })}
        >
          {oldLang('TelegramFaq')}
        </ListItem>
        <ListItem
          icon="privacy-policy"
          narrow
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => openUrl({ url: PRIVACY_URL })}
        >
          {oldLang('PrivacyPolicy')}
        </ListItem>
      </div>
      <ConfirmDialog
        isOpen={isSupportDialogOpen}
        confirmLabel={oldLang('lng_settings_ask_ok')}
        title={oldLang('AskAQuestion')}
        text={oldLang('lng_settings_ask_sure')}
        confirmHandler={handleOpenSupport}
        onClose={closeSupportDialog}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { currentUserId } = global;
    const isGiveawayAvailable = selectIsGiveawayGiftsPurchaseAvailable(global);
    const starsBalance = global.stars?.balance;
    const shouldDisplayStars = Boolean(global.stars?.history?.all?.transactions.length);

    return {
      sessionCount: global.activeSessions.orderedHashes.length,
      currentUserId,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      isGiveawayAvailable,
      starsBalance,
      shouldDisplayStars,
    };
  },
)(SettingsMain));
