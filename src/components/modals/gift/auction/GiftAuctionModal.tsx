import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStarGiftAuctionState } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { TME_LINK_PREFIX } from '../../../../config';
import { selectTabState } from '../../../../global/selectors';
import { copyTextToClipboard } from '../../../../util/clipboard';
import { formatCountdown, formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { HOUR } from '../../../../util/dates/units';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import {
  getRandomGiftPreviewAttributes, getStickerFromGift, type GiftPreviewAttributes,
  preloadGiftAttributeStickers } from '../../../common/helpers/gifts';

import useInterval from '../../../../hooks/schedulers/useInterval';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Button from '../../../ui/Button';
import Link from '../../../ui/Link';
import MenuItem from '../../../ui/MenuItem';
import TextTimer from '../../../ui/TextTimer';
import TableInfoModal, { type TableData } from '../../common/TableInfoModal';
import GiftItemStar from '../GiftItemStar';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftAuctionModal.module.scss';

const TEXT_TIMER_THRESHOLD = 48 * HOUR;
const PREVIEW_UPDATE_INTERVAL = 3000;

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
    openAboutStarGiftModal,
    showNotification,
    openChatWithDraft,
    openUrl,
    openGiftInMarket,
  } = getActions();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const renderingAuctionState = useCurrentOrPrev(auctionState);

  const gift = renderingAuctionState?.gift;
  const state = renderingAuctionState?.state;
  const userState = renderingAuctionState?.userState;
  const isFinished = state?.type === 'finished';

  const [previewAttributes, setPreviewAttributes] = useState<GiftPreviewAttributes | undefined>();
  const shouldUseUniqueHeader = Boolean(gift && state && previewAttributes);

  const uniqueHeaderRef = useRef<HTMLDivElement>();
  const lang = useLang();

  const updatePreviewAttributes = useLastCallback(() => {
    if (!renderingModal?.sampleAttributes) return;
    setPreviewAttributes(getRandomGiftPreviewAttributes(renderingModal.sampleAttributes, previewAttributes));
  });

  useInterval(updatePreviewAttributes, isOpen ? PREVIEW_UPDATE_INTERVAL : undefined, true);

  useEffect(() => {
    if (isOpen) {
      if (renderingModal?.sampleAttributes) {
        updatePreviewAttributes();
      } else {
        setPreviewAttributes(undefined);
      }
    }
  }, [isOpen, renderingModal?.sampleAttributes]);

  useEffect(() => {
    const attributes = renderingModal?.sampleAttributes;
    if (!attributes) return;
    preloadGiftAttributeStickers(attributes);
  }, [renderingModal?.sampleAttributes]);

  const handleClose = useLastCallback(() => closeGiftAuctionModal());

  const handleLearnMoreClick = useLastCallback(() => {
    if (!gift) return;
    openGiftAuctionInfoModal({ auctionGiftId: gift.id });
  });

  const handleLearnMoreAboutGiftsClick = useLastCallback(() => {
    openAboutStarGiftModal({});
  });

  const handleItemsBoughtClick = useLastCallback(() => {
    if (!gift) return;
    const giftSticker = getStickerFromGift(gift);
    openGiftAuctionAcquiredModal({ giftId: gift.id, giftTitle: gift.title, giftSticker });
  });

  const handleJoinClick = useLastCallback(() => {
    if (!gift) return;
    closeGiftAuctionModal({ shouldKeepAuction: true });
    setGiftModalSelectedGift({ gift });
  });

  const auctionLink = useMemo(() => {
    if (!gift?.auctionSlug) return undefined;
    return `${TME_LINK_PREFIX}auction/${gift.auctionSlug}`;
  }, [gift]);

  const handleCopyLink = useLastCallback(() => {
    if (!auctionLink) return;
    copyTextToClipboard(auctionLink);
    showNotification({
      message: lang('LinkCopied'),
    });
  });

  const handleShareLink = useLastCallback(() => {
    if (!auctionLink) return;
    openChatWithDraft({ text: { text: auctionLink } });
  });

  const handleOpenFragment = useLastCallback(() => {
    if (state?.type === 'finished' && state.fragmentListedUrl) {
      openUrl({ url: state.fragmentListedUrl });
    }
  });

  const handleOpenTelegramMarket = useLastCallback(() => {
    if (!gift) return;
    handleClose();
    openGiftInMarket({ gift });
  });

  const uniqueHeader = useMemo(() => {
    if (!shouldUseUniqueHeader) {
      return undefined;
    }

    const giftTitle = gift!.title || lang('StarGift');
    const badge = isFinished ? lang('GiftAuctionEnded') : lang('GiftAuctionInfoTitle');
    const subtitle = (
      <Link className={styles.learnMoreLink} isPrimary onClick={handleLearnMoreAboutGiftsClick}>
        {lang('GiftAuctionLearnMoreAboutGifts')}
      </Link>
    );

    return (
      <div ref={uniqueHeaderRef}>
        <UniqueGiftHeader
          modelAttribute={previewAttributes!.model}
          backdropAttribute={previewAttributes!.backdrop}
          patternAttribute={previewAttributes!.pattern}
          title={giftTitle}
          badge={badge}
          subtitle={subtitle}
        />
      </div>
    );
  }, [shouldUseUniqueHeader, gift, isFinished, lang, previewAttributes, handleLearnMoreAboutGiftsClick]);

  const regularHeader = useMemo(() => {
    if (!gift || !state || shouldUseUniqueHeader) {
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
  }, [gift, state, shouldUseUniqueHeader, isFinished, lang, handleLearnMoreClick]);

  const header = uniqueHeader || regularHeader;

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

    const canBuyOnFragment = state.type === 'finished'
      && Boolean(state.fragmentListedUrl && state.fragmentListedCount);
    const canBuyOnTelegram = state.type === 'finished' && Boolean(state.listedCount);

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
        {canBuyOnFragment && (
          <Link className={styles.itemsBoughtLink} isPrimary onClick={handleOpenFragment}>
            {lang('GiftAuctionForSaleOnFragment', {
              count: giftSticker ? (
                <>
                  {lang.number(state.fragmentListedCount!)}
                  <AnimatedIconFromSticker
                    className={styles.itemsBoughtSticker}
                    sticker={giftSticker}
                    size={20}
                    play={false}
                  />
                </>
              ) : lang.number(state.fragmentListedCount!),
            }, { withNodes: true })}
          </Link>
        )}
        {canBuyOnTelegram && (
          <Link className={styles.itemsBoughtLink} isPrimary onClick={handleOpenTelegramMarket}>
            {lang('GiftAuctionForSaleOnTelegram', {
              count: giftSticker ? (
                <>
                  {lang.number(state.listedCount!)}
                  <AnimatedIconFromSticker
                    className={styles.itemsBoughtSticker}
                    sticker={giftSticker}
                    size={20}
                    play={false}
                  />
                </>
              ) : lang.number(state.listedCount!),
            }, { withNodes: true })}
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
  }, [gift, state, userState, isFinished, lang, handleJoinClick, handleItemsBoughtClick, handleClose,
    handleOpenFragment, handleOpenTelegramMarket]);

  const moreMenuItems = useMemo(() => {
    if (!shouldUseUniqueHeader) return undefined;

    return (
      <>
        <MenuItem icon="info" onClick={handleLearnMoreClick}>
          {lang('GiftAuctionLearnMoreMenuItem')}
        </MenuItem>
        <MenuItem icon="link-badge" onClick={handleCopyLink}>
          {lang('CopyLink')}
        </MenuItem>
        <MenuItem icon="forward" onClick={handleShareLink}>
          {lang('Share')}
        </MenuItem>
      </>
    );
  }, [shouldUseUniqueHeader, lang, handleLearnMoreClick, handleCopyLink, handleShareLink]);

  return (
    <TableInfoModal
      isOpen={isOpen}
      header={header}
      footer={modalData?.footer}
      tableData={modalData?.tableData}
      className={styles.modal}
      contentClassName={styles.modalContent}
      closeButtonColor={shouldUseUniqueHeader ? 'translucent-white' : undefined}
      moreMenuItems={moreMenuItems}
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { giftAuctionModal } = selectTabState(global);
    const auctionGiftId = giftAuctionModal?.auctionGiftId;
    return {
      auctionState: auctionGiftId
        ? global.giftAuctionByGiftId?.[auctionGiftId] : undefined,
    };
  },
)(GiftAuctionModal));
