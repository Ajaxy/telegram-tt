import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiStarsAmount, ApiTonAmount } from '../../../api/types';
import { SettingsScreens } from '../../../types';

import { FAQ_URL, PRIVACY_URL, TON_CURRENCY_CODE } from '../../../config';
import { formatStarsAmount } from '../../../global/helpers/payments';
import {
  selectIsGiveawayGiftsPurchaseAvailable,
  selectIsPremiumPurchaseBlocked,
} from '../../../global/selectors';
import { convertCurrencyFromBaseUnit } from '../../../util/formatCurrency';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import ChatExtra from '../../common/profile/ChatExtra';
import ProfileInfo from '../../common/profile/ProfileInfo';
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
  tonBalance?: ApiTonAmount;
};

const SettingsMain: FC<OwnProps & StateProps> = ({
  isActive,
  currentUserId,
  sessionCount,
  canBuyPremium,
  isGiveawayAvailable,
  starsBalance,
  tonBalance,
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
            isForSettings
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
        <ListItem
          leftElement={<Icon className="icon ListItem-main-icon" name="toncoin" />}
          narrow
          onClick={() => openStarsBalanceModal({ currency: TON_CURRENCY_CODE })}
        >
          {lang('MenuTon')}
          {Boolean(tonBalance) && (
            <span className="settings-item__current-value">
              {convertCurrencyFromBaseUnit(tonBalance.amount, tonBalance.currency)}
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
  (global): Complete<StateProps> => {
    const { currentUserId } = global;
    const isGiveawayAvailable = selectIsGiveawayGiftsPurchaseAvailable(global);
    const starsBalance = global.stars?.balance;
    const tonBalance = global.ton?.balance;

    return {
      sessionCount: global.activeSessions.orderedHashes.length,
      currentUserId,
      canBuyPremium: !selectIsPremiumPurchaseBlocked(global),
      isGiveawayAvailable,
      starsBalance,
      tonBalance,
    };
  },
)(SettingsMain));
