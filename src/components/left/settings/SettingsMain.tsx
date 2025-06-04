import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarsAmount } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { FAQ_URL, PRIVACY_URL } from '../../../config';
import { formatStarsAmount } from '../../../global/helpers/payments';
import {
  selectIsGiveawayGiftsPurchaseAvailable,
  selectIsPremiumPurchaseBlocked,
} from '../../../global/selectors';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import StarIcon from '../../common/icons/StarIcon';
import ChatExtra from '../../common/profile/ChatExtra';
import ProfileInfo from '../../common/ProfileInfo';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

type StateProps = {
  sessionCount: number;
  currentUserId?: string;
  canBuyPremium?: boolean;
  isGiveawayAvailable?: boolean;
  starsBalance?: ApiStarsAmount;
};

const SettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  currentUserId,
  sessionCount,
  canBuyPremium,
  isGiveawayAvailable,
  starsBalance,
  onReset,
}) => {
  const {
    loadMoreProfilePhotos,
    openPremiumModal,
    openSupportChat,
    openUrl,
    openGiftRecipientPicker,
    openStarsBalanceModal,
    openSettingsScreen,
  } = getActions();

  const [isSupportDialogOpen, openSupportDialog, closeSupportDialog] = useFlag(false);

  const lang = useLang();

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
      <div className="settings-main-menu self-profile">
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
      </div>
      <div className="settings-main-menu">
        <ListItem
          icon="settings"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.General })}
        >
          {lang('TelegramGeneralSettingsViewController')}
        </ListItem>
        <ListItem
          icon="animations"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Performance })}
        >
          {lang('MenuAnimations')}
        </ListItem>
        <ListItem
          icon="unmute"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Notifications })}
        >
          {lang('Notifications')}
        </ListItem>
        <ListItem
          icon="data"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.DataStorage })}
        >
          {lang('DataSettings')}
        </ListItem>
        <ListItem
          icon="lock"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Privacy })}
        >
          {lang('PrivacySettings')}
        </ListItem>
        <ListItem
          icon="folder"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Folders })}
        >
          {lang('Filters')}
        </ListItem>
        <ListItem
          icon="active-sessions"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.ActiveSessions })}
        >
          {lang('SessionsTitle')}
          {sessionCount > 0 && (<span className="settings-item__current-value">{sessionCount}</span>)}
        </ListItem>
        <ListItem
          icon="language"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Language })}
        >
          {lang('Language')}
          <span className="settings-item__current-value">{lang.languageInfo.nativeName}</span>
        </ListItem>
        <ListItem
          icon="stickers"
          narrow

          onClick={() => openSettingsScreen({ screen: SettingsScreens.Stickers })}
        >
          {lang('MenuStickers')}
        </ListItem>
      </div>
      <div className="settings-main-menu">
        {canBuyPremium && (
          <ListItem
            leftElement={<StarIcon className="icon ListItem-main-icon" type="premium" size="big" />}
            narrow

            onClick={() => openPremiumModal()}
          >
            {lang('TelegramPremium')}
          </ListItem>
        )}
        <ListItem
          leftElement={<StarIcon className="icon ListItem-main-icon" type="gold" size="big" />}
          narrow

          onClick={() => openStarsBalanceModal({})}
        >
          {lang('MenuStars')}
          {Boolean(starsBalance) && (
            <span className="settings-item__current-value">
              {formatStarsAmount(lang, starsBalance)}
            </span>
          )}
        </ListItem>
        {isGiveawayAvailable && (
          <ListItem
            icon="gift"
            narrow

            onClick={() => openGiftRecipientPicker()}
          >
            {lang('MenuSendGift')}
          </ListItem>
        )}
      </div>
      <div className="settings-main-menu">
        <ListItem
          icon="ask-support"
          narrow
          onClick={openSupportDialog}
        >
          {lang('AskAQuestion')}
        </ListItem>
        <ListItem
          icon="help"
          narrow

          onClick={() => openUrl({ url: FAQ_URL })}
        >
          {lang('MenuTelegramFaq')}
        </ListItem>
        <ListItem
          icon="privacy-policy"
          narrow

          onClick={() => openUrl({ url: PRIVACY_URL })}
        >
          {lang('MenuPrivacyPolicy')}
        </ListItem>
      </div>
      <ConfirmDialog
        isOpen={isSupportDialogOpen}
        confirmLabel={lang('OK')}
        title={lang('AskAQuestion')}
        textParts={lang('MenuAskText', undefined, { withNodes: true, renderTextFilters: ['br'] })}
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

    return {
      sessionCount: global.activeSessions.orderedHashes.length,
      currentUserId,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      isGiveawayAvailable,
      starsBalance,
    };
  },
)(SettingsMain));
