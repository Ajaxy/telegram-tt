import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionState } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectTabState } from '../../../../global/selectors';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import TableAboutModal, { type TableAboutData } from '../../common/TableAboutModal';

import styles from './GiftAuctionInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftAuctionInfoModal'];
};

type StateProps = {
  giftAuction?: ApiStarGiftAuctionState;
};

const GiftAuctionInfoModal = ({
  modal,
  giftAuction,
}: OwnProps & StateProps) => {
  const { closeGiftAuctionInfoModal } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal && giftAuction);

  const handleClose = useLastCallback(() => {
    closeGiftAuctionInfoModal();
  });

  const header = useMemo(() => {
    return (
      <div className={styles.header}>
        <div className={styles.iconWrapper}>
          <Icon name="auction-filled" className={styles.icon} />
        </div>
        <div className={styles.title}>
          {lang('GiftAuctionInfoTitle')}
        </div>
        <div className={styles.subtitle}>
          {lang('GiftAuctionInfoSubtitle')}
        </div>
      </div>
    );
  }, [lang]);

  const footer = useMemo(() => {
    if (!isOpen) return undefined;
    return (
      <div className={styles.footer}>
        <Button
          iconName="understood"
          iconClassName={styles.understoodIcon}
          onClick={handleClose}
        >
          {lang('ButtonUnderstood')}
        </Button>
      </div>
    );
  }, [lang, isOpen, handleClose]);

  const listItemData = useMemo(() => {
    const count = giftAuction?.gift.giftsPerRound || 0;
    return [
      ['auction-drop', lang('GiftAuctionInfoTopBiddersTitle', { count }, { pluralValue: count }),
        lang('GiftAuctionInfoTopBiddersSubtitle', { count }, { pluralValue: count })],
      ['auction-next-round', lang('GiftAuctionInfoBidCarryoverTitle'),
        lang('GiftAuctionInfoBidCarryoverSubtitle', { count })],
      ['stars-refund', lang('GiftAuctionInfoMissedBiddersTitle'),
        lang('GiftAuctionInfoMissedBiddersSubtitle')],
    ] satisfies TableAboutData;
  }, [lang, giftAuction]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { giftAuctionInfoModal } = selectTabState(global);
    const auctionGiftId = giftAuctionInfoModal?.auctionGiftId;
    return {
      giftAuction: auctionGiftId
        ? global.giftAuctionByGiftId?.[auctionGiftId] : undefined,
    };
  },
)(GiftAuctionInfoModal));
