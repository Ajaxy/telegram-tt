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
import buildClassName from '../../../util/buildClassName';
import { convertCurrencyFromBaseUnit } from '../../../util/formatCurrency';
import { formatStarsAsIcon, formatTonAsIcon } from '../../../util/localization/format';

import useFlag from '../../../hooks/useFlag';
import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import ChatExtra from '../../common/profile/ChatExtra';
import ProfileInfo from '../../common/profile/ProfileInfo';
import Island from '../../gili/layout/Island';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ListItem from '../../ui/ListItem';

import styles from './SettingsMain.module.scss';

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
    <div className={buildClassName(styles.root, 'settings-main-scroll', 'custom-scroll')}>
      <div className={styles.selfProfile}>
        {currentUserId && (
          <ProfileInfo
            peerId={currentUserId}
            isActive={Boolean(isActive)}
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
      <div className={styles.menuSection}>
        <Island>
          <ListItem
            icon="account-filled"
            iconBg="blue"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.EditProfile })}
          >
            <span className="title">{lang('SettingsAccount')}</span>
            <span className="subtitle">{lang('SettingsAccountDesc')}</span>
          </ListItem>

          <ListItem
            icon="settings-filled"
            iconBg="orange"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.General })}
          >
            <span className="title">{lang('TelegramGeneralSettingsViewController')}</span>
            <span className="subtitle">{lang('SettingsGeneralDesc')}</span>
          </ListItem>

          <ListItem
            icon="notifications-filled"
            iconBg="red"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Notifications })}
          >
            <span className="title">{lang('Notifications')}</span>
            <span className="subtitle">{lang('SettingsNotificationsDesc')}</span>
          </ListItem>

          <ListItem
            icon="lock-filled"
            iconBg="gray"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Privacy })}
          >
            <span className="title">{lang('PrivacySettings')}</span>
            <span className="subtitle">{lang('SettingsPrivacyDesc')}</span>
          </ListItem>

          <ListItem
            icon="piechart-filled"
            iconBg="green"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.DataStorage })}
          >
            <span className="title">{lang('DataSettings')}</span>
            <span className="subtitle">{lang('SettingsDataDesc')}</span>
          </ListItem>

          <ListItem
            icon="folder-filled"
            iconBg="blue"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Folders })}
          >
            <span className="title">{lang('Filters')}</span>
            <span className="subtitle">{lang('SettingsFoldersDesc')}</span>
          </ListItem>

          <ListItem
            icon="animations-filled"
            iconBg="purple"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Performance })}
          >
            <span className="title">{lang('MenuAnimations')}</span>
            <span className="subtitle">{lang('SettingsPerformanceDesc')}</span>
          </ListItem>

          <ListItem
            icon="smile-filled"
            iconBg="pink"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Stickers })}
          >
            <span className="title">{lang('MenuStickers')}</span>
            <span className="subtitle">{lang('SettingsStickersDesc')}</span>
          </ListItem>

          <ListItem
            icon="web-filled"
            iconBg="purple"
            multiline
            narrow
            onClick={() => openSettingsScreen({ screen: SettingsScreens.Language })}
          >
            <span className="title">{lang('Language')}</span>
            <span className="subtitle">
              {lang('SettingsLanguageDesc', { language: lang.languageInfo?.nativeName || lang.rawCode })}
            </span>
          </ListItem>

          <ListItem
            icon="devices-filled"
            iconBg="blue"
            multiline
            narrow
            rightElement={sessionCount > 0
              ? <span className="settings-item__current-value">{sessionCount}</span>
              : undefined}
            onClick={() => openSettingsScreen({ screen: SettingsScreens.ActiveSessions })}
          >
            <span className="title">{lang('SessionsTitle')}</span>
            <span className="subtitle">{lang('SettingsSessionsDesc')}</span>
          </ListItem>
        </Island>

        <Island>
          {canBuyPremium && (
            <ListItem
              icon="premium-filled"
              iconBg="premium"
              narrow
              onClick={() => openPremiumModal()}
            >
              {lang('TelegramPremium')}
            </ListItem>
          )}

          <ListItem
            icon="stars-filled"
            iconBg="orange"
            narrow
            onClick={() => openStarsBalanceModal({})}
          >
            {lang('MenuStars')}
            {Boolean(starsBalance) && (
              <span className="settings-item__current-value">
                {formatStarsAsIcon(lang, formatStarsAmount(lang, starsBalance), {
                  asFont: true,
                  withIconLast: true,
                  className: styles.balanceStar,
                })}
              </span>
            )}
          </ListItem>

          <ListItem
            icon="gram-filled"
            iconBg="blue"
            narrow
            onClick={() => openStarsBalanceModal({ currency: TON_CURRENCY_CODE })}
          >
            {lang('MenuGram')}
            {Boolean(tonBalance) && (
              <span className="settings-item__current-value">
                {formatTonAsIcon(lang, convertCurrencyFromBaseUnit(tonBalance.amount, tonBalance.currency), {
                  withIconLast: true,
                  className: styles.balanceGem,
                })}
              </span>
            )}
          </ListItem>

          {isGiveawayAvailable && (
            <ListItem
              icon="gift-filled"
              iconBg="orange"
              narrow
              onClick={() => openGiftRecipientPicker()}
            >
              {lang('MenuSendGift')}
            </ListItem>
          )}
        </Island>

        <Island>
          <ListItem
            icon="support-filled"
            iconBg="red"
            narrow
            onClick={openSupportDialog}
          >
            {lang('AskAQuestion')}
          </ListItem>
          <ListItem
            icon="help-filled"
            iconBg="blue"
            narrow
            onClick={() => openUrl({ url: FAQ_URL })}
          >
            {lang('MenuTelegramFaq')}
          </ListItem>
          <ListItem
            icon="privacy-policy-filled"
            iconBg="green"
            narrow
            onClick={() => openUrl({ url: PRIVACY_URL })}
          >
            {lang('MenuPrivacyPolicy')}
          </ListItem>
        </Island>
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
