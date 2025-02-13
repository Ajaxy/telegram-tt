import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { selectTabState } from '../../global/selectors';
import { pick } from '../../util/iteratees';

import VerificationMonetizationModal from '../common/VerificationMonetizationModal.async';
import WebAppsCloseConfirmationModal from '../main/WebAppsCloseConfirmationModal.async';
import AboutAdsModal from './aboutAds/AboutAdsModal.async';
import AttachBotInstallModal from './attachBotInstall/AttachBotInstallModal.async';
import BoostModal from './boost/BoostModal.async';
import ChatInviteModal from './chatInvite/ChatInviteModal.async';
import ChatlistModal from './chatlist/ChatlistModal.async';
import CollectibleInfoModal from './collectible/CollectibleInfoModal.async';
import EmojiStatusAccessModal from './emojiStatusAccess/EmojiStatusAccessModal.async';
import PremiumGiftModal from './gift/GiftModal.async';
import GiftInfoModal from './gift/info/GiftInfoModal.async';
import GiftRecipientPicker from './gift/recipient/GiftRecipientPicker.async';
import GiftStatusInfoModal from './gift/status/GiftStatusInfoModal.async';
import GiftTransferModal from './gift/transfer/GiftTransferModal.async';
import GiftUpgradeModal from './gift/upgrade/GiftUpgradeModal.async';
import GiftWithdrawModal from './gift/withdraw/GiftWithdrawModal.async';
import GiftCodeModal from './giftcode/GiftCodeModal.async';
import InviteViaLinkModal from './inviteViaLink/InviteViaLinkModal.async';
import LocationAccessModal from './locationAccess/LocationAccessModal.async';
import MapModal from './map/MapModal.async';
import OneTimeMediaModal from './oneTimeMedia/OneTimeMediaModal.async';
import PaidReactionModal from './paidReaction/PaidReactionModal.async';
import ReportAdModal from './reportAd/ReportAdModal.async';
import ReportModal from './reportModal/ReportModal.async';
import StarsGiftModal from './stars/gift/StarsGiftModal.async';
import StarsBalanceModal from './stars/StarsBalanceModal.async';
import StarsPaymentModal from './stars/StarsPaymentModal.async';
import StarsSubscriptionModal from './stars/subscription/StarsSubscriptionModal.async';
import StarsTransactionInfoModal from './stars/transaction/StarsTransactionModal.async';
import SuggestedStatusModal from './suggestedStatus/SuggestedStatusModal.async';
import UrlAuthModal from './urlAuth/UrlAuthModal.async';
import WebAppModal from './webApp/WebAppModal.async';

// `Pick` used only to provide tab completion
type ModalKey = keyof Pick<TabState,
'giftCodeModal' |
'boostModal' |
'chatlistModal' |
'urlAuth' |
'mapModal' |
'oneTimeMediaModal' |
'inviteViaLinkModal' |
'requestedAttachBotInstall' |
'collectibleInfoModal' |
'reportAdModal' |
'reportModal' |
'starsBalanceModal' |
'starsPayment' |
'starsTransactionModal' |
'paidReactionModal' |
'webApps' |
'starsTransactionModal' |
'chatInviteModal' |
'starsSubscriptionModal' |
'starsGiftModal' |
'giftModal' |
'isGiftRecipientPickerOpen' |
'isWebAppsCloseConfirmationModalOpen' |
'giftInfoModal' |
'suggestedStatusModal' |
'emojiStatusAccessModal' |
'locationAccessModal' |
'aboutAdsModal' |
'giftUpgradeModal' |
'monetizationVerificationModal' |
'giftWithdrawModal' |
'giftStatusInfoModal' |
'giftTransferModal'
>;

type StateProps = {
  [K in ModalKey]?: TabState[K];
};
type ModalRegistry = {
  [K in ModalKey]: React.FC<{
    modal: TabState[K];
  }>;
};
type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

const MODALS: ModalRegistry = {
  giftCodeModal: GiftCodeModal,
  boostModal: BoostModal,
  chatlistModal: ChatlistModal,
  urlAuth: UrlAuthModal,
  oneTimeMediaModal: OneTimeMediaModal,
  inviteViaLinkModal: InviteViaLinkModal,
  requestedAttachBotInstall: AttachBotInstallModal,
  reportAdModal: ReportAdModal,
  reportModal: ReportModal,
  webApps: WebAppModal,
  collectibleInfoModal: CollectibleInfoModal,
  mapModal: MapModal,
  starsPayment: StarsPaymentModal,
  starsBalanceModal: StarsBalanceModal,
  starsTransactionModal: StarsTransactionInfoModal,
  chatInviteModal: ChatInviteModal,
  paidReactionModal: PaidReactionModal,
  starsSubscriptionModal: StarsSubscriptionModal,
  starsGiftModal: StarsGiftModal,
  giftModal: PremiumGiftModal,
  isGiftRecipientPickerOpen: GiftRecipientPicker,
  isWebAppsCloseConfirmationModalOpen: WebAppsCloseConfirmationModal,
  giftInfoModal: GiftInfoModal,
  suggestedStatusModal: SuggestedStatusModal,
  emojiStatusAccessModal: EmojiStatusAccessModal,
  locationAccessModal: LocationAccessModal,
  aboutAdsModal: AboutAdsModal,
  giftUpgradeModal: GiftUpgradeModal,
  monetizationVerificationModal: VerificationMonetizationModal,
  giftWithdrawModal: GiftWithdrawModal,
  giftStatusInfoModal: GiftStatusInfoModal,
  giftTransferModal: GiftTransferModal,
};
const MODAL_KEYS = Object.keys(MODALS) as ModalKey[];
const MODAL_ENTRIES = Object.entries(MODALS) as Entries<ModalRegistry>;

const ModalContainer = (modalProps: StateProps) => {
  return MODAL_ENTRIES.map(([key, ModalComponent]) => (
    // @ts-ignore -- TS does not preserve tuple types in `map` callbacks
    <ModalComponent key={key} modal={modalProps[key]} />
  ));
};

export default memo(withGlobal(
  (global): StateProps => (
    pick(selectTabState(global), MODAL_KEYS)
  ),
)(ModalContainer));
