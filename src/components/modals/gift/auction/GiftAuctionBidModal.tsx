import { memo, useEffect, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type {
  ApiPeer,
  ApiStarGiftAuctionState,
  ApiStarsAmount,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectPeer, selectTabState } from '../../../../global/selectors';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import renderText from '../../../common/helpers/renderText';

import { useTransitionActiveKey } from '../../../../hooks/animations/useTransitionActiveKey';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedCounter from '../../../common/AnimatedCounter';
import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import FullNameTitle from '../../../common/FullNameTitle';
import StarIcon from '../../../common/icons/StarIcon';
import Button from '../../../ui/Button';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import InputText from '../../../ui/InputText';
import Modal from '../../../ui/Modal';
import TextTimer from '../../../ui/TextTimer';
import Transition from '../../../ui/Transition';
import StarSlider from '../../paidReaction/StarSlider';
import BalanceBlock from '../../stars/BalanceBlock';

import styles from './GiftAuctionBidModal.module.scss';

export type OwnProps = {
  modal: TabState['giftAuctionBidModal'];
};

type StateProps = {
  auctionState?: ApiStarGiftAuctionState;
  starBalance?: ApiStarsAmount;
  currentUserPeer?: ApiPeer;
  topBidderIds?: string[];
};

const DEFAULT_BID_AMOUNT = 50;
const MAX_BID_AMOUNT_STEP = 50000;
const MAX_CUSTOM_BID_AMOUNT = 1000000000;
const BID_ROUNDING_STEP = 10000;
const MIN_SLIDER_PROGRESS = 0.25;
const GIFT_STICKER_SIZE = 24;
const DEFAULT_TOP_BIDDERS_COUNT = 3;

const GiftAuctionBidModal = ({
  modal,
  auctionState,
  starBalance,
  currentUserPeer,
  topBidderIds,
}: OwnProps & StateProps) => {
  const { closeGiftAuctionBidModal, sendStarGiftAuctionBid, loadActiveGiftAuction } = getActions();

  const isOpen = Boolean(modal?.isOpen);

  const renderingAuctionState = useCurrentOrPrev(auctionState);
  const renderingTopBidderIds = useCurrentOrPrev(topBidderIds);

  const renderingTopBidderPeers = useMemo(() => {
    if (!renderingTopBidderIds) return undefined;
    const global = getGlobal();
    return renderingTopBidderIds
      .map((id) => selectPeer(global, id))
      .filter(Boolean);
  }, [renderingTopBidderIds]);

  const [topBidder1, topBidder2, topBidder3] = renderingTopBidderPeers || [];

  const topBidder1Key = useTransitionActiveKey([topBidder1?.id || '0']);
  const topBidder2Key = useTransitionActiveKey([topBidder2?.id || '0']);
  const topBidder3Key = useTransitionActiveKey([topBidder3?.id || '0']);

  const giftsPerRound = renderingAuctionState?.gift.giftsPerRound || 0;

  const lang = useLang();

  const activeState = renderingAuctionState?.state.type === 'active'
    ? renderingAuctionState.state
    : undefined;
  const userState = renderingAuctionState?.userState;

  const [selectedBidAmount, setSelectedBidAmount] = useState(DEFAULT_BID_AMOUNT);
  const [isCustomBidModalOpen, openCustomBidModal, closeCustomBidModal] = useFlag();
  const [customBidValue, setCustomBidValue] = useState('');

  const baseMinBid = activeState?.minBidAmount || DEFAULT_BID_AMOUNT;

  const currentMinBid = userState?.minBidAmount || baseMinBid;

  const sliderMaxValue = Math.ceil(currentMinBid / BID_ROUNDING_STEP) * BID_ROUNDING_STEP + MAX_BID_AMOUNT_STEP;

  const currentProgress = (currentMinBid - baseMinBid) / (sliderMaxValue - baseMinBid);
  const adjustedMinBid = Math.floor(
    (currentMinBid - MIN_SLIDER_PROGRESS * sliderMaxValue) / (1 - MIN_SLIDER_PROGRESS),
  );
  const giftMinBid = currentProgress > MIN_SLIDER_PROGRESS
    ? Math.max(1, adjustedMinBid)
    : baseMinBid;

  useEffect(() => {
    setSelectedBidAmount(currentMinBid);
  }, [currentMinBid]);

  const nextRoundAt = activeState?.nextRoundAt;

  const bidDifference = userState?.bidAmount ? selectedBidAmount - userState.bidAmount : 0;
  const isAtMaxValue = selectedBidAmount >= sliderMaxValue;

  const sliderSecondaryText = useMemo(() => {
    if (isAtMaxValue) return lang('GiftAuctionTapToBidMore');
    if (bidDifference <= 0) return undefined;
    return (
      <>
        +
        <AnimatedCounter text={lang.number(bidDifference)} />
      </>
    );
  }, [bidDifference, isAtMaxValue, lang]);

  const handleAmountChange = useLastCallback((value: number) => {
    setSelectedBidAmount(value);
  });

  const handleTimerEnd = useLastCallback(() => {
    if (!renderingAuctionState?.gift.id) return;
    loadActiveGiftAuction({ giftId: renderingAuctionState.gift.id });
  });

  const handleBadgeClick = useLastCallback(() => {
    if (isAtMaxValue) {
      openCustomBidModal();
    }
  });

  const handleCustomBidChange = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    const numValue = Number(value);
    if (numValue > MAX_CUSTOM_BID_AMOUNT) return;
    setCustomBidValue(value);
  });

  const handleCustomBidSubmit = useLastCallback(() => {
    if (!renderingAuctionState?.gift.id || !modal) return;

    const resultValue = Number(customBidValue);
    if (resultValue < currentMinBid) return;

    setSelectedBidAmount(resultValue);
    closeCustomBidModal();

    setCustomBidValue('');

    const { peerId, message, shouldHideName } = modal;
    const isUpdateBid = Boolean(userState?.bidAmount);

    sendStarGiftAuctionBid({
      giftId: renderingAuctionState.gift.id,
      bidAmount: resultValue,
      peerId,
      message: message ? { text: message } : undefined,
      shouldHideName,
      isUpdateBid,
    });
  });

  const handleSubmit = useLastCallback(() => {
    if (!renderingAuctionState?.gift.id || !modal) return;
    const { peerId, message, shouldHideName } = modal;
    const isUpdateBid = Boolean(userState?.bidAmount);

    sendStarGiftAuctionBid({
      giftId: renderingAuctionState.gift.id,
      bidAmount: selectedBidAmount,
      peerId,
      message: message ? { text: message } : undefined,
      shouldHideName,
      isUpdateBid,
    });
  });

  const userPosition = useMemo(() => {
    if (!selectedBidAmount || !activeState?.bidLevels?.length) return undefined;

    const { bidLevels } = activeState;
    const userBidDate = userState?.bidDate || Number.MAX_SAFE_INTEGER;

    for (const level of bidLevels) {
      if (level.amount < selectedBidAmount
        || (level.amount === selectedBidAmount && level.date >= userBidDate)) {
        return level.pos;
      }
    }

    return bidLevels[bidLevels.length - 1].pos + 1;
  }, [selectedBidAmount, activeState, userState?.bidDate]);

  function renderInfoCards() {
    return (
      <div className={styles.infoCards}>
        <div className={styles.infoCard}>
          <div className={styles.infoCardValue}>
            <StarIcon type="gold" size="adaptive" />
            {lang.number(currentMinBid)}
          </div>
          <div className={styles.infoCardLabel}>{lang('GiftAuctionMinimumBid')}</div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoCardValue}>
            <TextTimer endsAt={nextRoundAt || 0} shouldShowZeroOnEnd onEnd={handleTimerEnd} />
          </div>
          <div className={styles.infoCardLabel}>{lang('GiftAuctionUntilNextRound')}</div>
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoCardValue}>
            <AnimatedIconFromSticker
              noLoop={false}
              className={styles.giftSticker}
              sticker={renderingAuctionState?.gift.sticker}
              size={GIFT_STICKER_SIZE}
            />
            {lang.number(activeState?.giftsLeft || 0)}
          </div>
          <div className={styles.infoCardLabel}>{lang('GiftAuctionLeft')}</div>
        </div>
      </div>
    );
  }

  const isWinning = Boolean(userState?.bidAmount && userPosition && userPosition <= giftsPerRound);

  function renderCurrentBidSectionTitle() {
    const giftTitle = renderingAuctionState?.gift.title || lang('StarGift');
    const nextGiftNum = userPosition && userPosition <= 100
      ? (activeState?.lastGiftNum || 0) + userPosition
      : undefined;

    return (
      <Transition
        name="fade"
        activeKey={isWinning ? 0 : 1}
        className={styles.sectionTitleTransition}
        slideClassName={styles.bidderInfoSlide}
      >
        {isWinning ? (
          <div className={styles.winningStatus}>
            <span className={styles.winningText}>{lang('GiftAuctionYoureWinning')}</span>
            <span className={styles.winningBadge}>
              {lang('GiftUnique', { title: giftTitle, number: nextGiftNum ? lang.number(nextGiftNum) : undefined })}
            </span>
          </div>
        ) : (
          <div className={styles.sectionTitle}>{lang('GiftAuctionYourBidWillBe')}</div>
        )}
      </Transition>
    );
  }

  function renderUserBid() {
    return (
      <div className={styles.section}>
        {renderCurrentBidSectionTitle()}
        <div className={styles.bidderRow}>
          <div className={styles.bidderPosition}>
            {userPosition && userPosition > 100 ? `${userPosition}+` : (userPosition || 1)}
          </div>
          <div className={styles.bidderInfo}>
            {currentUserPeer && <Avatar peer={currentUserPeer} size="small" />}
            {currentUserPeer && <FullNameTitle peer={currentUserPeer} className={styles.bidderName} />}
          </div>
          <div className={styles.bidderAmount}>
            <StarIcon type="gold" size="adaptive" />
            {lang.number(selectedBidAmount)}
          </div>
        </div>
      </div>
    );
  }

  function renderTopBidderRow(
    index: number,
    emoji: string,
    peer: ApiPeer | undefined,
    amount: number | undefined,
    activeKey: number,
  ) {
    return (
      <div className={styles.topBidderRow} key={index}>
        <div className={styles.topBidderPosition}>
          {renderText(emoji, ['emoji'])}
        </div>
        <Transition
          name="fade"
          activeKey={activeKey}
          className={styles.bidderInfo}
          slideClassName={styles.bidderInfoSlide}
        >
          {peer && (
            <>
              <Avatar peer={peer} size="small" />
              <FullNameTitle peer={peer} className={styles.bidderName} />
            </>
          )}
        </Transition>
        {amount !== undefined && (
          <div className={styles.bidderAmount}>
            <StarIcon type="gold" size="adaptive" />
            {lang.number(amount)}
          </div>
        )}
      </div>
    );
  }

  function renderTopWinners() {
    const topCount = DEFAULT_TOP_BIDDERS_COUNT;
    const bidLevels = activeState?.bidLevels;

    return (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {lang('GiftAuctionTopWinners', { count: topCount }, { pluralValue: topCount })}
        </div>
        {renderTopBidderRow(0, '🥇', topBidder1, bidLevels?.[0]?.amount, topBidder1Key)}
        {renderTopBidderRow(1, '🥈', topBidder2, bidLevels?.[1]?.amount, topBidder2Key)}
        {renderTopBidderRow(2, '🥉', topBidder3, bidLevels?.[2]?.amount, topBidder3Key)}
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      hasAbsoluteCloseButton
      isSlim
      contentClassName={styles.content}
      onClose={closeGiftAuctionBidModal}
      isLowStackPriority
    >
      <div className={styles.headerControlPanel}>
        <BalanceBlock balance={starBalance} className={styles.modalBalance} withAddButton />
      </div>

      <StarSlider
        className={styles.slider}
        defaultValue={currentMinBid}
        minValue={giftMinBid}
        minAllowedValue={currentMinBid}
        maxValue={sliderMaxValue}
        floatingBadgeDescription={sliderSecondaryText}
        onChange={handleAmountChange}
        onBadgeClick={handleBadgeClick}
        shouldUseDynamicColor
        shouldAllowCustomValue
      />

      <h3 className={styles.title}>{lang('GiftAuctionPlaceBid')}</h3>
      {renderInfoCards()}

      {renderUserBid()}
      {renderTopWinners()}

      <Button noForcedUpperCase onClick={handleSubmit}>
        {lang(userState?.bidAmount ? 'GiftAuctionAddToBid' : 'GiftAuctionPlaceBidButton', {
          amount: formatStarsAsIcon(lang,
            userState?.bidAmount ? selectedBidAmount - userState.bidAmount : selectedBidAmount,
            { asFont: true, className: styles.buttonStar }),
        }, { withNodes: true })}
      </Button>
      <ConfirmDialog
        isOpen={isCustomBidModalOpen}
        title={lang('GiftAuctionCustomBidTitle')}
        confirmLabel={lang('GiftAuctionCustomBidButton')}
        isConfirmDisabled={!customBidValue || Number(customBidValue) < currentMinBid}
        confirmHandler={handleCustomBidSubmit}
        onClose={closeCustomBidModal}
      >
        <p>{lang('GiftAuctionCustomBidDescription', { count: renderingAuctionState?.gift.giftsPerRound })}</p>
        <div className={styles.customBidInput}>
          <StarIcon type="gold" size="adaptive" className={styles.customBidInputIcon} />
          <InputText
            value={customBidValue}
            onChange={handleCustomBidChange}
            placeholder={lang('GiftAuctionCustomBidPlaceholder')}
            inputMode="numeric"
            teactExperimentControlled
          />
        </div>
      </ConfirmDialog>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { activeGiftAuction } = selectTabState(global);
    const { stars, currentUserId } = global;

    const currentUserPeer = currentUserId ? selectPeer(global, currentUserId) : undefined;

    const topBidderIds = activeGiftAuction?.state.type === 'active'
      ? activeGiftAuction.state.topBidders
      : undefined;

    return {
      auctionState: activeGiftAuction,
      starBalance: stars?.balance,
      currentUserPeer,
      topBidderIds,
    };
  },
)(GiftAuctionBidModal));
