import { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionAcquiredGift, ApiSticker } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectTabState } from '../../../../global/selectors';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { formatStarsAsIcon } from '../../../../util/localization/format';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useScrollNotch from '../../../../hooks/useScrollNotch';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import BadgeButton from '../../../common/BadgeButton';
import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';
import TableInfo, { type TableData } from '../../common/TableInfo';

import styles from './GiftAuctionAcquiredModal.module.scss';

export type OwnProps = {
  modal: TabState['giftAuctionAcquiredModal'];
};

type StateProps = {
  acquiredGifts?: ApiStarGiftAuctionAcquiredGift[];
  giftTitle?: string;
  giftSticker?: ApiSticker;
};

const GiftAuctionAcquiredModal = ({ modal, acquiredGifts, giftTitle, giftSticker }: OwnProps & StateProps) => {
  const { closeGiftAuctionAcquiredModal } = getActions();

  const containerRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const isOpen = Boolean(modal?.giftId);
  const renderingGifts = useCurrentOrPrev(acquiredGifts);
  const renderingGiftTitle = useCurrentOrPrev(giftTitle);
  const renderingGiftSticker = useCurrentOrPrev(giftSticker);

  const handleClose = useLastCallback(() => {
    closeGiftAuctionAcquiredModal();
  });

  const giftItems = useMemo(() => {
    if (!renderingGifts?.length) return undefined;

    return renderingGifts.map((gift) => {
      const header = lang('GiftAuctionBoughtGiftHeader', {
        gift: renderingGiftTitle || lang('StarGift'),
        giftNumber: gift.giftNumber ? lang.number(gift.giftNumber) : '',
        round: lang.number(gift.round),
      });

      const tableData: TableData = [
        [undefined, (
          <span className={styles.giftHeader}>
            {renderingGiftSticker && (
              <AnimatedIconFromSticker
                className={styles.giftSticker}
                sticker={renderingGiftSticker}
                size={20}
                play={false}
              />
            )}
            <span>{header}</span>
          </span>
        )],
        [lang('GiftAuctionRecipient'), { chatId: gift.peerId }],
        [lang('GiftAuctionDate'), formatDateTimeToString(gift.date * 1000, lang.code, true)],
        [lang('GiftAuctionAcceptedBid'), (
          <span className={styles.bidValue}>
            {formatStarsAsIcon(lang, gift.bidAmount, { className: styles.starIcon })}
            <BadgeButton className={styles.badge}>
              {lang('GiftAuctionTopPosition', { position: gift.position })}
            </BadgeButton>
          </span>
        )],
      ];

      return { tableData, key: `${gift.round}-${gift.giftNumber}` };
    });
  }, [renderingGifts, renderingGiftTitle, renderingGiftSticker, lang]);

  const giftsCount = renderingGifts?.length || 0;

  useScrollNotch({
    containerRef,
    selector: `.${styles.giftsList}`,
    isBottomNotch: true,
  }, [giftItems]);

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      title={lang('GiftAuctionBoughtGiftsTitle', { count: giftsCount }, { pluralValue: giftsCount })}
      className={styles.modal}
      contentClassName={styles.content}
      onClose={handleClose}
      isCondensedHeader
      isSlim
    >
      <div className={styles.giftsListContainer} ref={containerRef}>
        <div className={styles.giftsList}>
          {giftItems?.map((item) => (
            <TableInfo key={item.key} tableData={item.tableData} />
          ))}
        </div>
      </div>
      <Button className={styles.okButton} onClick={handleClose}>
        {lang('OK')}
      </Button>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { giftAuctionAcquiredModal } = selectTabState(global);

    return {
      acquiredGifts: giftAuctionAcquiredModal?.acquiredGifts,
      giftTitle: giftAuctionAcquiredModal?.giftTitle,
      giftSticker: giftAuctionAcquiredModal?.giftSticker,
    };
  },
)(GiftAuctionAcquiredModal));
