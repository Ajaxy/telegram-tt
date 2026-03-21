import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionState, ApiStarGiftAuctionStateActive } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import { partition } from '../../../../util/iteratees';
import { getBidAuctionPosition } from '../../../common/helpers/gifts';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useHeaderPane, { type PaneState } from '../../../middle/hooks/useHeaderPane';

import CustomEmoji from '../../../common/CustomEmoji';
import Button from '../../../ui/Button';
import TextTimer from '../../../ui/TextTimer';

import paneStyles from './ChatPane.module.scss';
import styles from './GiftAuctionPane.module.scss';

type OwnProps = {
  canShow?: boolean;
  onPaneStateChange: (state: PaneState) => void;
};

type StateProps = Pick<GlobalState, 'activeGiftAuctionIds' | 'giftAuctionByGiftId'>;

const GiftAuctionPane = ({
  canShow,
  activeGiftAuctionIds,
  giftAuctionByGiftId,
  onPaneStateChange,
}: OwnProps & StateProps) => {
  const { openGiftAuctionBidModal, openActiveGiftAuctionsModal } = getActions();
  const isOpen = canShow && Boolean(activeGiftAuctionIds?.length);
  const lang = useLang();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    onStateChange: onPaneStateChange,
    withResizeObserver: true,
  });

  const [activeAuctions, winningCount, outbidCount] = useMemo(() => {
    const auctions = activeGiftAuctionIds?.map((id) => giftAuctionByGiftId?.[id])
      .filter((auc): auc is ApiStarGiftAuctionState => (
        auc?.state.type === 'active' && Boolean(auc.userState.bidAmount)),
      );

    if (!auctions) return [undefined, 0, 0];
    const [winning, outbid] = partition(auctions, (auction) => {
      const state = auction.state as ApiStarGiftAuctionStateActive;
      const position = getBidAuctionPosition(
        auction.userState.bidAmount!, auction.userState.bidDate!, state.bidLevels,
      );
      return position <= auction.gift.giftsPerRound!;
    });
    return [auctions, winning.length, outbid.length];
  }, [activeGiftAuctionIds, giftAuctionByGiftId]);
  const activeAuctionsCount = activeAuctions?.length || 0;
  const singleActiveAuction = activeAuctions?.length === 1 ? activeAuctions[0] : undefined;

  function renderSubtitleText() {
    if (!winningCount && !outbidCount) return undefined;
    if (winningCount && !outbidCount) return lang('ChatListAuctionWinning');
    if (!winningCount && outbidCount) return lang('ChatListAuctionOutbid');
    return lang('ChatListAuctionMixed', { winCount: winningCount, outbidCount });
  }

  const handleClick = useLastCallback(() => {
    if (!activeAuctions?.length) return;
    if (singleActiveAuction) {
      openGiftAuctionBidModal({ auctionGiftId: singleActiveAuction.gift.id });
      return;
    }

    openActiveGiftAuctionsModal();
  });

  if (!shouldRender) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName(paneStyles.pane, styles.root)}
      role="button"
      tabIndex={0}
      onClick={handleClick}
    >
      <div className={buildClassName(paneStyles.title, styles.title)}>
        <span className={styles.giftEmojis}>
          {activeAuctions?.map((auction) => (
            <CustomEmoji
              key={auction.gift.id}
              sticker={auction.gift.sticker}
              loopLimit={1}
            />
          ))}
        </span>
        {lang('ChatListAuctionTitle', { count: activeAuctionsCount }, { pluralValue: activeAuctionsCount })}
      </div>
      <div
        className={buildClassName(
          paneStyles.subtitle, styles.subtitle, !winningCount && outbidCount && styles.outbid,
        )}
      >
        {renderSubtitleText()}
      </div>
      <Button
        className={styles.button}
        iconName={singleActiveAuction ? 'auction-filled' : undefined}
        iconClassName={styles.buttonIcon}
        size="tiny"
        pill
        onClick={handleClick}
      >
        {singleActiveAuction ? (
          <TextTimer
            endsAt={(singleActiveAuction.state as ApiStarGiftAuctionStateActive).nextRoundAt}
            shouldShowZeroOnEnd
          />
        ) : lang('ChatListAuctionView')}
      </Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      activeGiftAuctionIds: global.activeGiftAuctionIds,
      giftAuctionByGiftId: global.giftAuctionByGiftId,
    };
  },
)(GiftAuctionPane));
