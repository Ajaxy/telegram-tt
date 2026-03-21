import { memo, useMemo } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionState, ApiStarGiftAuctionStateActive } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { formatStarsAsIcon } from '../../../../util/localization/format';
import { getBidAuctionPosition } from '../../../common/helpers/gifts';
import { REM } from '../../../common/helpers/mediaDimensions';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import CustomEmoji from '../../../common/CustomEmoji';
import Button from '../../../ui/Button';
import ListItem from '../../../ui/ListItem';
import Modal from '../../../ui/Modal';
import TextTimer from '../../../ui/TextTimer';

import styles from './ActiveGiftAuctionsModal.module.scss';

export type OwnProps = {
  modal: TabState['activeGiftAuctionsModal'];
};

type StateProps = {
  activeGiftAuctionIds?: string[];
  giftAuctionByGiftId?: Record<string, ApiStarGiftAuctionState>;
};

const ICON_SIZE = 2 * REM;

const ActiveGiftAuctionsModal = ({
  modal, activeGiftAuctionIds, giftAuctionByGiftId,
}: OwnProps & StateProps) => {
  const { closeActiveGiftAuctionsModal } = getActions();
  const lang = useLang();

  const activeAuctions = useMemo(() => {
    return activeGiftAuctionIds?.map((id) => giftAuctionByGiftId?.[id])
      .filter((auc): auc is ApiStarGiftAuctionState => (
        auc?.state.type === 'active' && Boolean(auc.userState.bidAmount)
      ));
  }, [activeGiftAuctionIds, giftAuctionByGiftId]);

  return (
    <Modal
      isOpen={Boolean(modal)}
      onClose={closeActiveGiftAuctionsModal}
      hasCloseButton
      isCondensedHeader
      title={lang('GiftAuctionActiveTitle')}
      dialogClassName={styles.dialog}
      contentClassName={styles.content}
    >
      {activeAuctions?.length
        ? activeAuctions.map((auction) => <ActiveAuctionItem key={auction.gift.id} auction={auction} />)
        : <div className={styles.noActive}>{lang('GiftAuctionNoActive')}</div>}
    </Modal>
  );
};

function ActiveAuctionItem({ auction }: { auction: ApiStarGiftAuctionState }) {
  const lang = useLang();
  const { openGiftAuctionBidModal, closeActiveGiftAuctionsModal } = getActions();

  const { userState, gift } = auction;
  const state = auction.state as ApiStarGiftAuctionStateActive;

  const bidPosition = useMemo(() => {
    return getBidAuctionPosition(userState.bidAmount!, userState.bidDate!, state.bidLevels);
  }, [userState, state.bidLevels]);

  const handleClick = useLastCallback(() => {
    openGiftAuctionBidModal({ auctionGiftId: gift.id });
    closeActiveGiftAuctionsModal();
  });

  return (
    <ListItem
      leftElement={<CustomEmoji className={styles.gift} sticker={gift.sticker} size={ICON_SIZE} loopLimit={1} />}
      rightElement={(
        <Button
          size="tiny"
          pill
          fluid
          iconName="auction-filled"
          onClick={handleClick}
        >
          {lang('GiftAuctionListRaiseBid')}
          <TextTimer className={styles.timer} endsAt={state.nextRoundAt} shouldShowZeroOnEnd />
        </Button>
      )}
      multiline
      onClick={handleClick}
    >
      <div className="title">
        {lang('GiftAuctionListRound', {
          current: lang.number(state.currentRound),
          total: lang.number(state.totalRounds),
        })}
      </div>
      <div className="subtitle">
        {lang('GiftAuctionBidPosition', {
          amount: formatStarsAsIcon(lang, userState.bidAmount!),
          position: lang.number(bidPosition),
        }, {
          withNodes: true,
        })}
      </div>
    </ListItem>
  );
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { activeGiftAuctionIds, giftAuctionByGiftId } = global;
    return {
      activeGiftAuctionIds,
      giftAuctionByGiftId,
    };
  },
)(ActiveGiftAuctionsModal));
