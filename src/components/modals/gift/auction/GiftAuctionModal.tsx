import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionState } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { selectTabState } from '../../../../global/selectors';
import { formatCountdown, formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { HOUR } from '../../../../util/dates/units';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import { getStickerFromGift } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import TextTimer from '../../../ui/TextTimer';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';
import GiftItemStar from '../GiftItemStar';

import styles from './GiftAuctionModal.module.scss';

const TEXT_TIMER_THRESHOLD = 48 * HOUR;

export type OwnProps = {
  modal: TabState['giftAuctionModal'];
};

type StateProps = {
  auctionState?: ApiStarGiftAuctionState;
};

const GiftAuctionModal = ({ modal, auctionState }: OwnProps & StateProps) => {
  const {
    closeGiftAuctionModal,
    setGiftModalSelectedGift,
    openGiftAuctionInfoModal,
    openGiftAuctionAcquiredModal,
  } = getActions();

  const isOpen = Boolean(modal?.isOpen);
  const renderingAuctionState = useCurrentOrPrev(auctionState);

  const gift = renderingAuctionState?.gift;
  const state = renderingAuctionState?.state;
  const userState = renderingAuctionState?.userState;
  const isFinished = state?.type === 'finished';

  const lang = useLang();

  const handleClose = useLastCallback(() => closeGiftAuctionModal());

  const handleLearnMoreClick = useLastCallback(() => {
    openGiftAuctionInfoModal({});
  });

  const handleItemsBoughtClick = useLastCallback(() => {
    if (!gift) return;
    const giftSticker = getStickerFromGift(gift);
    openGiftAuctionAcquiredModal({ giftId: gift.id, giftTitle: gift.title, giftSticker });
  });

  const handleJoinClick = useLastCallback(() => {
    if (!gift) return;
    closeGiftAuctionModal({ shouldKeepActiveAuction: true });
    setGiftModalSelectedGift({ gift });
  });

  const header = useMemo(() => {
    if (!gift || !state) {
      return undefined;
    }

    const giftTitle = gift.title || lang('StarGift');
    const giftsPerRound = gift.giftsPerRound || 0;

    return (
      <div className={styles.header}>
        <GiftItemStar gift={gift} hideBadge noClickable />
        <h1 className={styles.title}>
          {giftTitle}
        </h1>
        {isFinished ? (
          <span className={styles.finishedBadge}>{lang('GiftAuctionEnded')}</span>
        ) : (
          <p className={styles.description}>
            {lang('GiftAuctionTopBidders', {
              count: giftsPerRound,
              gift: <span className={styles.giftName}>{giftTitle}</span>,
              link: <Link isPrimary onClick={handleLearnMoreClick}>{lang('GiftAuctionLearnMore')}</Link>,
            }, { pluralValue: giftsPerRound, withNodes: true, withMarkdown: true })}
          </p>
        )}
      </div>
    );
  }, [gift, state, isFinished, lang, handleLearnMoreClick]);

  const modalData = useMemo(() => {
    if (!gift || !state || !userState) {
      return undefined;
    }

    const tableData: TableData = [];

    tableData.push([
      lang('GiftAuctionStarted'),
      formatDateTimeToString(state.startDate * 1000, lang.code, true),
    ]);

    tableData.push([
      lang('GiftAuctionEnds'),
      formatDateTimeToString(state.endDate * 1000, lang.code, true),
    ]);

    if (gift.availabilityTotal) {
      tableData.push([
        lang('GiftInfoAvailability'),
        lang('GiftInfoAvailabilityValue', {
          count: gift.availabilityRemains || 0,
          total: lang.number(gift.availabilityTotal),
        }, { pluralValue: gift.availabilityRemains || 0 }),
      ]);
    }

    if (state.type === 'active') {
      tableData.push([
        lang('GiftAuctionCurrentRound'),
        lang('GiftAuctionRoundValue', {
          current: lang.number(state.currentRound),
          total: lang.number(state.totalRounds),
        }),
      ]);
    }

    if (isFinished) {
      tableData.push([
        lang('GiftAuctionAveragePrice'),
        formatStarsAsIcon(lang, state.averagePrice, { className: styles.starIcon }),
      ]);
    }

    const acquiredCount = userState.acquiredCount;
    const giftSticker = getStickerFromGift(gift);
    const auctionTimeLeft = state.endDate - getServerTime();
    const shouldUseTextTimer = auctionTimeLeft > 0 && auctionTimeLeft < TEXT_TIMER_THRESHOLD;

    const footer = (
      <div className={styles.footer}>
        {acquiredCount > 0 && (
          <Link className={styles.itemsBoughtLink} isPrimary onClick={handleItemsBoughtClick}>
            {lang('GiftAuctionItemsBought', {
              count: acquiredCount,
              gift: giftSticker && (
                <AnimatedIconFromSticker
                  className={styles.itemsBoughtSticker}
                  sticker={giftSticker}
                  size={20}
                  play={false}
                />
              ),
            }, { pluralValue: acquiredCount, withNodes: true })}
          </Link>
        )}
        <Button
          noForcedUpperCase
          className={styles.footerButton}
          onClick={isFinished ? handleClose : handleJoinClick}
        >
          {isFinished ? lang('OK') : (
            <div>
              <div>
                {lang('GiftAuctionJoin')}
              </div>
              {auctionTimeLeft > 0 && (
                <div className={styles.buttonSubtitle}>
                  {lang('GiftAuctionTimeLeft', {
                    time: shouldUseTextTimer
                      ? <TextTimer endsAt={state.endDate} />
                      : formatCountdown(lang, auctionTimeLeft),
                  }, { withNodes: true })}
                </div>
              )}
            </div>
          )}
        </Button>
      </div>
    );

    return {
      tableData,
      footer,
    };
  }, [gift, state, userState, isFinished, lang, handleJoinClick, handleItemsBoughtClick, handleClose]);

  return (
    <TableInfoModal
      isOpen={isOpen}
      header={header}
      footer={modalData?.footer}
      tableData={modalData?.tableData}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { activeGiftAuction } = selectTabState(global);

    return {
      auctionState: activeGiftAuction,
    };
  },
)(GiftAuctionModal));
