import { type FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { selectTabState } from '../../global/selectors';
import { pick } from '../../util/iteratees';

import VerificationMonetizationModal from '../common/VerificationMonetizationModal.async';
import WebAppsCloseConfirmationModal from '../main/WebAppsCloseConfirmationModal.async';
import AboutAdsModal from './aboutAds/AboutAdsModal.async';
import AgeVerificationModal from './ageVerification/AgeVerificationModal.async';
import AttachBotInstallModal from './attachBotInstall/AttachBotInstallModal.async';
import BirthdaySetupModal from './birthday/BirthdaySetupModal.async';
import BoostModal from './boost/BoostModal.async';
import ChatInviteModal from './chatInvite/ChatInviteModal.async';
import ChatlistModal from './chatlist/ChatlistModal.async';
import CollectibleInfoModal from './collectible/CollectibleInfoModal.async';
import DeleteAccountModal from './deleteAccount/DeleteAccountModal.async';
import EmojiStatusAccessModal from './emojiStatusAccess/EmojiStatusAccessModal.async';
import FrozenAccountModal from './frozenAccount/FrozenAccountModal.async';
import AboutStarGiftModal from './gift/AboutStarGiftModal.async';
import GiftAuctionAcquiredModal from './gift/auction/GiftAuctionAcquiredModal.async';
import GiftAuctionBidModal from './gift/auction/GiftAuctionBidModal.async';
import GiftAuctionChangeRecipientModal from './gift/auction/GiftAuctionChangeRecipientModal.async';
import GiftAuctionInfoModal from './gift/auction/GiftAuctionInfoModal.async';
import GiftAuctionModal from './gift/auction/GiftAuctionModal.async';
import PremiumGiftModal from './gift/GiftModal.async';
import GiftInfoModal from './gift/info/GiftInfoModal.async';
import GiftLockedModal from './gift/locked/GiftLockedModal.async';
import GiftDescriptionRemoveModal from './gift/message/GiftDescriptionRemoveModal.async';
import GiftOfferAcceptModal from './gift/offer/GiftOfferAcceptModal.async';
import GiftRecipientPicker from './gift/recipient/GiftRecipientPicker.async';
import GiftResalePriceComposerModal from './gift/resale/GiftResalePriceComposerModal.async';
import StarGiftPriceDecreaseInfoModal from './gift/StarGiftPriceDecreaseInfoModal.async';
import GiftStatusInfoModal from './gift/status/GiftStatusInfoModal.async';
import GiftTransferConfirmModal from './gift/transfer/GiftTransferConfirmModal.async';
import GiftTransferModal from './gift/transfer/GiftTransferModal.async';
import GiftUpgradeModal from './gift/upgrade/GiftUpgradeModal.async';
import GiftInfoValueModal from './gift/value/GiftInfoValueModal.async';
import GiftWithdrawModal from './gift/withdraw/GiftWithdrawModal.async';
import GiftCodeModal from './giftcode/GiftCodeModal.async';
import InviteViaLinkModal from './inviteViaLink/InviteViaLinkModal.async';
import LocationAccessModal from './locationAccess/LocationAccessModal.async';
import MapModal from './map/MapModal.async';
import OneTimeMediaModal from './oneTimeMedia/OneTimeMediaModal.async';
import PaidReactionModal from './paidReaction/PaidReactionModal.async';
import PasskeyModal from './passkey/PasskeyModal.async';
import PreparedMessageModal from './preparedMessage/PreparedMessageModal.async';
import PriceConfirmModal from './priceConfirm/PriceConfirmModal.async';
import ProfileRatingModal from './profileRating/ProfileRatingModal.async';
import QuickPreviewModal from './quickPreview/QuickPreviewModal.async';
import ReportAdModal from './reportAd/ReportAdModal.async';
import ReportModal from './reportModal/ReportModal.async';
import SharePreparedMessageModal from './sharePreparedMessage/SharePreparedMessageModal.async';
import ChatRefundModal from './stars/chatRefund/ChatRefundModal.async';
import StarsGiftModal from './stars/gift/StarsGiftModal.async';
import StarsBalanceModal from './stars/StarsBalanceModal.async';
import StarsPaymentModal from './stars/StarsPaymentModal.async';
import StarsSubscriptionModal from './stars/subscription/StarsSubscriptionModal.async';
import StarsTransactionInfoModal from './stars/transaction/StarsTransactionModal.async';
import StealthModeModal from './storyStealthMode/StealthModeModal.async';
import SuggestedPostApprovalModal from './suggestedPostApproval/SuggestedPostApprovalModal.async';
import SuggestedStatusModal from './suggestedStatus/SuggestedStatusModal.async';
import SuggestMessageModal from './suggestMessage/SuggestMessageModal.async';
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
  'suggestMessageModal' |
  'suggestedPostApprovalModal' |
  'webApps' |
  'chatInviteModal' |
  'starsSubscriptionModal' |
  'starsGiftModal' |
  'giftModal' |
  'isGiftRecipientPickerOpen' |
  'isWebAppsCloseConfirmationModalOpen' |
  'giftInfoModal' |
  'giftInfoValueModal' |
  'lockedGiftModal' |
  'giftResalePriceComposerModal' |
  'suggestedStatusModal' |
  'emojiStatusAccessModal' |
  'locationAccessModal' |
  'aboutAdsModal' |
  'giftUpgradeModal' |
  'giftAuctionModal' |
  'giftAuctionBidModal' |
  'giftAuctionInfoModal' |
  'giftAuctionChangeRecipientModal' |
  'giftAuctionAcquiredModal' |
  'starGiftPriceDecreaseInfoModal' |
  'aboutStarGiftModal' |
  'monetizationVerificationModal' |
  'giftWithdrawModal' |
  'preparedMessageModal' |
  'sharePreparedMessageModal' |
  'giftStatusInfoModal' |
  'giftTransferModal' |
  'giftTransferConfirmModal' |
  'giftDescriptionRemoveModal' |
  'giftOfferAcceptModal' |
  'chatRefundModal' |
  'priceConfirmModal' |
  'isFrozenAccountModalOpen' |
  'deleteAccountModal' |
  'isAgeVerificationModalOpen' |
  'profileRatingModal' |
  'quickPreview' |
  'storyStealthModal' |
  'isPasskeyModalOpen' |
  'birthdaySetupModal'
>;

type StateProps = {
  [K in ModalKey]?: TabState[K];
};
type ModalRegistry = {
  [K in ModalKey]: FC<{
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
  suggestMessageModal: SuggestMessageModal,
  suggestedPostApprovalModal: SuggestedPostApprovalModal,
  starsSubscriptionModal: StarsSubscriptionModal,
  starsGiftModal: StarsGiftModal,
  giftModal: PremiumGiftModal,
  isGiftRecipientPickerOpen: GiftRecipientPicker,
  isWebAppsCloseConfirmationModalOpen: WebAppsCloseConfirmationModal,
  giftInfoModal: GiftInfoModal,
  giftInfoValueModal: GiftInfoValueModal,
  lockedGiftModal: GiftLockedModal,
  giftResalePriceComposerModal: GiftResalePriceComposerModal,
  suggestedStatusModal: SuggestedStatusModal,
  emojiStatusAccessModal: EmojiStatusAccessModal,
  locationAccessModal: LocationAccessModal,
  aboutAdsModal: AboutAdsModal,
  giftUpgradeModal: GiftUpgradeModal,
  giftAuctionModal: GiftAuctionModal,
  giftAuctionBidModal: GiftAuctionBidModal,
  giftAuctionInfoModal: GiftAuctionInfoModal,
  giftAuctionChangeRecipientModal: GiftAuctionChangeRecipientModal,
  giftAuctionAcquiredModal: GiftAuctionAcquiredModal,
  starGiftPriceDecreaseInfoModal: StarGiftPriceDecreaseInfoModal,
  aboutStarGiftModal: AboutStarGiftModal,
  monetizationVerificationModal: VerificationMonetizationModal,
  giftWithdrawModal: GiftWithdrawModal,
  giftStatusInfoModal: GiftStatusInfoModal,
  preparedMessageModal: PreparedMessageModal,
  sharePreparedMessageModal: SharePreparedMessageModal,
  giftTransferModal: GiftTransferModal,
  giftTransferConfirmModal: GiftTransferConfirmModal,
  giftDescriptionRemoveModal: GiftDescriptionRemoveModal,
  giftOfferAcceptModal: GiftOfferAcceptModal,
  chatRefundModal: ChatRefundModal,
  priceConfirmModal: PriceConfirmModal,
  isFrozenAccountModalOpen: FrozenAccountModal,
  deleteAccountModal: DeleteAccountModal,
  isAgeVerificationModalOpen: AgeVerificationModal,
  profileRatingModal: ProfileRatingModal,
  quickPreview: QuickPreviewModal,
  storyStealthModal: StealthModeModal,
  isPasskeyModalOpen: PasskeyModal,
  birthdaySetupModal: BirthdaySetupModal,
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
  (global): Complete<StateProps> => (
    pick(selectTabState(global), MODAL_KEYS) as Complete<StateProps>
  ),
)(ModalContainer));
