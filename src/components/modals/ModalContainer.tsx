import { type FC, memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { selectCanAnimateInterface, selectTabState } from '../../global/selectors';
import { pick } from '../../util/iteratees';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useShowTransition from '../../hooks/useShowTransition';

import VerificationMonetizationModal from '../common/VerificationMonetizationModal.async';
import SafeLinkModal from '../main/SafeLinkModal.async';
import WebAppsCloseConfirmationModal from '../main/WebAppsCloseConfirmationModal.async';
import AiMessageEditorModal from '../middle/composer/AiMessageEditorModal/AiMessageEditorModal.async';
import AboutAdsModal from './aboutAds/AboutAdsModal.async';
import AgeVerificationModal from './ageVerification/AgeVerificationModal.async';
import AiTonePreviewModal from './aiTonePreview/AiTonePreviewModal.async';
import AttachBotInstallModal from './attachBotInstall/AttachBotInstallModal.async';
import BirthdaySetupModal from './birthday/BirthdaySetupModal.async';
import BoostModal from './boost/BoostModal.async';
import ChatInviteModal from './chatInvite/ChatInviteModal.async';
import ChatlistModal from './chatlist/ChatlistModal.async';
import CocoonModal from './cocoon/CocoonModal.async';
import CollectibleInfoModal from './collectible/CollectibleInfoModal.async';
import DeleteAccountModal from './deleteAccount/DeleteAccountModal.async';
import DisableSharingAboutModal from './disableSharing/DisableSharingAboutModal.async';
import EmojiStatusAccessModal from './emojiStatusAccess/EmojiStatusAccessModal.async';
import FrozenAccountModal from './frozenAccount/FrozenAccountModal.async';
import AboutStarGiftModal from './gift/AboutStarGiftModal.async';
import ActiveGiftAuctionsModal from './gift/auction/ActiveGiftAuctionsModal.async';
import GiftAuctionAcquiredModal from './gift/auction/GiftAuctionAcquiredModal.async';
import GiftAuctionBidModal from './gift/auction/GiftAuctionBidModal.async';
import GiftAuctionChangeRecipientModal from './gift/auction/GiftAuctionChangeRecipientModal.async';
import GiftAuctionInfoModal from './gift/auction/GiftAuctionInfoModal.async';
import GiftAuctionModal from './gift/auction/GiftAuctionModal.async';
import GiftCraftInfoModal from './gift/craft/GiftCraftInfoModal.async';
import GiftCraftModal from './gift/craft/GiftCraftModal.async';
import GiftCraftSelectModal from './gift/craft/GiftCraftSelectModal.async';
import PremiumGiftModal from './gift/GiftModal.async';
import GiftInfoModal from './gift/info/GiftInfoModal.async';
import GiftLockedModal from './gift/locked/GiftLockedModal.async';
import GiftDescriptionRemoveModal from './gift/message/GiftDescriptionRemoveModal.async';
import GiftOfferAcceptModal from './gift/offer/GiftOfferAcceptModal.async';
import GiftPreviewModal from './gift/preview/GiftPreviewModal.async';
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
import InstantViewer from './instantView/InstantViewer.async';
import InviteViaLinkModal from './inviteViaLink/InviteViaLinkModal.async';
import LeaveGroupModal from './leaveGroup/LeaveGroupModal.async';
import LocationAccessModal from './locationAccess/LocationAccessModal.async';
import MapModal from './map/MapModal.async';
import OneTimeMediaModal from './oneTimeMedia/OneTimeMediaModal.async';
import PaidReactionModal from './paidReaction/PaidReactionModal.async';
import PasskeyModal from './passkey/PasskeyModal.async';
import PollModal from './poll/PollModal.async';
import PreparedMessageModal from './preparedMessage/PreparedMessageModal.async';
import PriceConfirmModal from './priceConfirm/PriceConfirmModal.async';
import ProfileRatingModal from './profileRating/ProfileRatingModal.async';
import QuickChatPickerModal from './quickChatPicker/QuickChatPickerModal.async';
import QuickPreviewModal from './quickPreview/QuickPreviewModal.async';
import EditRankModal from './rank/EditRankModal.async';
import RankModal from './rank/RankModal.async';
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
import TwoFaCheckModal from './twoFaCheck/TwoFaCheckModal.async';
import UrlAuthModal from './urlAuth/UrlAuthModal.async';
import WebAppModal from './webApp/WebAppModal.async';

// `Pick` used only to provide tab completion
type ModalKey = keyof Pick<TabState,
  'aiMessageEditorModal' |
  'giftCodeModal' |
  'boostModal' |
  'chatlistModal' |
  'urlAuth' |
  'safeLinkModalUrl' |
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
  'pollModal' |
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
  'giftPreviewModal' |
  'giftUpgradeModal' |
  'giftCraftModal' |
  'giftCraftSelectModal' |
  'giftCraftInfoModal' |
  'giftAuctionModal' |
  'giftAuctionBidModal' |
  'giftAuctionInfoModal' |
  'giftAuctionChangeRecipientModal' |
  'giftAuctionAcquiredModal' |
  'activeGiftAuctionsModal' |
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
  'disableSharingAboutModal' |
  'priceConfirmModal' |
  'isFrozenAccountModalOpen' |
  'deleteAccountModal' |
  'isAgeVerificationModalOpen' |
  'profileRatingModal' |
  'instantViewModal' |
  'quickPreview' |
  'storyStealthModal' |
  'isPasskeyModalOpen' |
  'birthdaySetupModal' |
  'leaveGroupModal' |
  'isTwoFaCheckModalOpen' |
  'isQuickChatPickerOpen' |
  'isCocoonModalOpen' |
  'editRankModal' |
  'rankModal' |
  'aiTonePreviewModal'
>;
type WrappedModalKey = 'pollModal' | 'mapModal' | 'safeLinkModalUrl';
type LegacyModalKey = Exclude<ModalKey, WrappedModalKey>;

type ModalStateProps = {
  [K in ModalKey]?: TabState[K];
};
type StateProps = ModalStateProps & {
  shouldAnimateInterface: boolean;
};
type LegacyModalRegistry = {
  [K in LegacyModalKey]: FC<{
    modal: TabState[K];
  }>;
};
type WrappedModalRegistry = {
  [K in WrappedModalKey]: FC<{
    modal: NonNullable<TabState[K]>;
    isOpen: boolean;
  }>;
};
type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

const WRAPPED_MODAL_CLOSE_DURATION = 200;
const WRAPPED_MODAL_CLOSE_DURATIONS: Record<WrappedModalKey, number> = {
  pollModal: WRAPPED_MODAL_CLOSE_DURATION,
  mapModal: WRAPPED_MODAL_CLOSE_DURATION,
  safeLinkModalUrl: WRAPPED_MODAL_CLOSE_DURATION,
};

type WrappedModalBoundaryProps<T> = {
  modal: T;
  ModalComponent: FC<{
    modal: NonNullable<T>;
    isOpen: boolean;
  }>;
  closeDuration: number;
  shouldAnimateInterface: boolean;
};

const WrappedModalBoundary = <T,>({
  modal,
  ModalComponent,
  closeDuration,
  shouldAnimateInterface,
}: WrappedModalBoundaryProps<T>) => {
  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal, true);
  const { shouldRender } = useShowTransition({
    isOpen,
    withShouldRender: true,
    closeDuration,
    noCloseTransition: !shouldAnimateInterface,
  });

  if (!shouldRender || !renderingModal) {
    return undefined;
  }

  return <ModalComponent modal={renderingModal} isOpen={isOpen} />;
};

const LEGACY_MODALS: LegacyModalRegistry = {
  aiMessageEditorModal: AiMessageEditorModal,
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
  giftPreviewModal: GiftPreviewModal,
  giftUpgradeModal: GiftUpgradeModal,
  giftCraftModal: GiftCraftModal,
  giftCraftSelectModal: GiftCraftSelectModal,
  giftCraftInfoModal: GiftCraftInfoModal,
  giftAuctionModal: GiftAuctionModal,
  giftAuctionBidModal: GiftAuctionBidModal,
  giftAuctionInfoModal: GiftAuctionInfoModal,
  giftAuctionChangeRecipientModal: GiftAuctionChangeRecipientModal,
  giftAuctionAcquiredModal: GiftAuctionAcquiredModal,
  activeGiftAuctionsModal: ActiveGiftAuctionsModal,
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
  disableSharingAboutModal: DisableSharingAboutModal,
  priceConfirmModal: PriceConfirmModal,
  isFrozenAccountModalOpen: FrozenAccountModal,
  deleteAccountModal: DeleteAccountModal,
  isAgeVerificationModalOpen: AgeVerificationModal,
  profileRatingModal: ProfileRatingModal,
  instantViewModal: InstantViewer,
  quickPreview: QuickPreviewModal,
  storyStealthModal: StealthModeModal,
  isPasskeyModalOpen: PasskeyModal,
  birthdaySetupModal: BirthdaySetupModal,
  leaveGroupModal: LeaveGroupModal,
  isTwoFaCheckModalOpen: TwoFaCheckModal,
  isQuickChatPickerOpen: QuickChatPickerModal,
  isCocoonModalOpen: CocoonModal,
  editRankModal: EditRankModal,
  rankModal: RankModal,
  aiTonePreviewModal: AiTonePreviewModal,
};
const WRAPPED_MODALS: WrappedModalRegistry = {
  pollModal: PollModal,
  mapModal: MapModal,
  safeLinkModalUrl: SafeLinkModal,
};

const LEGACY_MODAL_KEYS = Object.keys(LEGACY_MODALS) as LegacyModalKey[];
const WRAPPED_MODAL_KEYS = Object.keys(WRAPPED_MODALS) as WrappedModalKey[];
const MODAL_KEYS = [...LEGACY_MODAL_KEYS, ...WRAPPED_MODAL_KEYS] as ModalKey[];

const LEGACY_MODAL_ENTRIES = Object.entries(LEGACY_MODALS) as Entries<LegacyModalRegistry>;
const WRAPPED_MODAL_ENTRIES = Object.entries(WRAPPED_MODALS) as Entries<WrappedModalRegistry>;

function renderWrappedModal<K extends WrappedModalKey>(
  key: K,
  ModalComponent: WrappedModalRegistry[K],
  modal: TabState[K],
  shouldAnimateInterface: boolean,
) {
  return (
    <WrappedModalBoundary<TabState[K]>
      key={key}
      modal={modal}
      ModalComponent={ModalComponent}
      closeDuration={WRAPPED_MODAL_CLOSE_DURATIONS[key]}
      shouldAnimateInterface={shouldAnimateInterface}
    />
  );
}

const ModalContainer = (modalProps: StateProps) => {
  const { shouldAnimateInterface } = modalProps;

  return [
    ...LEGACY_MODAL_ENTRIES.map(([key, ModalComponent]) => (
      // @ts-ignore -- TS does not preserve tuple types in `map` callbacks
      <ModalComponent key={key} modal={modalProps[key]} />
    )),
    ...WRAPPED_MODAL_ENTRIES.map(([key, ModalComponent]) => {
      return renderWrappedModal(key, ModalComponent, modalProps[key], shouldAnimateInterface);
    }),
  ];
};

export default memo(withGlobal(
  (global): Complete<StateProps> => ({
    ...(pick(selectTabState(global), MODAL_KEYS) as Complete<ModalStateProps>),
    shouldAnimateInterface: selectCanAnimateInterface(global),
  }),
)(ModalContainer));
