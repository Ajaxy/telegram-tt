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

  const lang = useOldLang();

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
            leftElement={<StarIcon className="icon" type="premium" size="big" />}
            className="settings-main-menu-star"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openPremiumModal()}
          >
            {lang('TelegramPremium')}
          </ListItem>
        )}
        {shouldDisplayStars && (
          <ListItem
            leftElement={<StarIcon className="icon" type="gold" size="big" />}
            className="settings-main-menu-star"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openStarsBalanceModal({})}
          >
            {lang('MenuTelegramStars')}
            {Boolean(starsBalance) && (
              <span className="settings-item__current-value">{formatInteger(starsBalance)}</span>
            )}
          </ListItem>
        )}
        {isGiveawayAvailable && (
          <ListItem
            icon="gift"
            className="settings-main-menu-star"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => openPremiumGiftingModal()}
          >
            {lang('GiftPremiumGifting')}
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
