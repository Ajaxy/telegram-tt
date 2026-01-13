import {
  memo, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiPeer } from '../../../../api/types';
import type { TabState } from '../../../../global/types';

import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import {
  getRandomGiftPreviewAttributes, type GiftPreviewAttributes,
  preloadGiftAttributeStickers } from '../../../common/helpers/gifts';

import useInterval from '../../../../hooks/schedulers/useInterval';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedCounter from '../../../common/AnimatedCounter';
import Icon from '../../../common/icons/Icon';
import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import Link from '../../../ui/Link';
import TextTimer from '../../../ui/TextTimer';
import TableAboutModal, { type TableAboutData } from '../../common/TableAboutModal';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftUpgradeModal.module.scss';

export type OwnProps = {
  modal: TabState['giftUpgradeModal'];
};

type StateProps = {
  recipient?: ApiPeer;
};

const PREVIEW_UPDATE_INTERVAL = 3000;

const GiftUpgradeModal = ({ modal, recipient }: OwnProps & StateProps) => {
  const {
    closeGiftUpgradeModal,
    closeGiftInfoModal,
    upgradeGift,
    upgradePrepaidGift,
    openStarGiftPriceDecreaseInfoModal,
    shiftGiftUpgradeNextPrice,
  } = getActions();
  const isOpen = Boolean(modal);

  const renderingModal = useCurrentOrPrev(modal);
  const renderingRecipient = useCurrentOrPrev(recipient);
  const [shouldKeepOriginalDetails, setShouldKeepOriginalDetails] = useState(false);

  const isPrepaid = Boolean(renderingModal?.gift?.prepaidUpgradeHash);

  const [previewAttributes, setPreviewAttributes] = useState<GiftPreviewAttributes | undefined>();

  const lang = useLang();

  const handleClose = useLastCallback(() => closeGiftUpgradeModal());

  const handleTimerEnd = useLastCallback(() => {
    shiftGiftUpgradeNextPrice();
  });

  const nextPrice = renderingModal?.nextPrices?.[0];
  const nextPriceDate = nextPrice?.date;
  const upgradeStars = renderingModal?.currentUpgradeStars;

  const handleUpgrade = useLastCallback(() => {
    const gift = renderingModal?.gift;

    if (!gift) return;

    if (isPrepaid && gift.prepaidUpgradeHash && renderingRecipient) {
      if (!upgradeStars) return;

      upgradePrepaidGift({
        peerId: renderingRecipient.id,
        hash: gift.prepaidUpgradeHash,
        stars: upgradeStars,
      });
      handleClose();
      closeGiftInfoModal();
      return;
    }

    if (!gift?.inputGift) return;

    upgradeGift({
      gift: gift.inputGift,
      shouldKeepOriginalDetails,
      upgradeStars: !gift.alreadyPaidUpgradeStars ? upgradeStars : undefined,
    });
    handleClose();
  });

  const updatePreviewAttributes = useLastCallback(() => {
    if (!renderingModal?.sampleAttributes) return;
    setPreviewAttributes(getRandomGiftPreviewAttributes(renderingModal.sampleAttributes, previewAttributes));
  });

  const handleOpenPriceInfo = useLastCallback(() => {
    if (!renderingModal?.prices) return;

    openStarGiftPriceDecreaseInfoModal({
      prices: renderingModal.prices,
      currentPrice: upgradeStars || 0,
      minPrice: renderingModal.minPrice || 0,
      maxPrice: renderingModal.maxPrice || 0,
    });
  });

  useInterval(updatePreviewAttributes, isOpen ? PREVIEW_UPDATE_INTERVAL : undefined, true);

  useEffect(() => {
    if (isOpen && renderingModal?.sampleAttributes) {
      updatePreviewAttributes();
    }
  }, [isOpen, renderingModal?.sampleAttributes]);

  useEffect(() => {
    const attributes = renderingModal?.sampleAttributes;
    if (!attributes) return;
    preloadGiftAttributeStickers(attributes);
  }, [renderingModal?.sampleAttributes]);

  const formattedPriceElement = useMemo(() => (upgradeStars ? (
    <span>
      <Icon name="star" className="star-amount-icon" />
      <AnimatedCounter text={lang.number(upgradeStars)} />
    </span>
  ) : undefined), [lang, upgradeStars]);

  const modalData = useMemo(() => {
    if (!previewAttributes || !isOpen) {
      return undefined;
    }

    const gift = renderingModal?.gift;

    const userName = renderingRecipient ? getPeerTitle(lang, renderingRecipient) : lang('ActionFallbackUser');

    const listItemData = (renderingRecipient ? [
      ['diamond', lang('GiftUpgradeUniqueTitle'), lang('GiftPeerUpgradeUniqueDescription', { user: userName })],
      ['trade', lang('GiftUpgradeTransferableTitle'),
        lang('GiftPeerUpgradeTransferableDescription', { user: userName })],
      ['auction', lang('GiftUpgradeTradeableTitle'), lang('GiftPeerUpgradeTradeableDescription', { user: userName })],
    ] : [
      ['diamond', lang('GiftUpgradeUniqueTitle'), lang('GiftUpgradeUniqueDescription')],
      ['trade', lang('GiftUpgradeTransferableTitle'), lang('GiftUpgradeTransferableDescription')],
      ['auction', lang('GiftUpgradeTradeableTitle'), lang('GiftUpgradeTradeableDescription')],
    ]) satisfies TableAboutData;

    const subtitle = renderingRecipient
      ? lang('GiftPeerUpgradeText', { peer: getPeerTitle(lang, renderingRecipient) })
      : lang('GiftUpgradeTextOwn');

    const hasPriceDecreaseInfo = Boolean(nextPriceDate)
      && Boolean(renderingModal?.prices?.length)
      && !gift?.alreadyPaidUpgradeStars;

    const header = (
      <UniqueGiftHeader
        modelAttribute={previewAttributes.model}
        backdropAttribute={previewAttributes.backdrop}
        patternAttribute={previewAttributes.pattern}
        title={lang('GiftUpgradeTitle')}
        subtitle={subtitle}
      />
    );

    const footer = (
      <div className={styles.footer}>
        {!gift && (
          <Button className={styles.footerButton} onClick={handleClose}>
            {lang('OK')}
          </Button>
        )}
        {gift && (
          <>
            {!isPrepaid && (
              <Checkbox
                label={lang('GiftUpgradeKeepDetails')}
                onCheck={setShouldKeepOriginalDetails}
                checked={shouldKeepOriginalDetails}
              />
            )}
            <Button className={styles.footerButton} isShiny onClick={handleUpgrade}>
              <div className={styles.buttonContent}>
                <div>
                  {gift.alreadyPaidUpgradeStars
                    ? lang('GeneralConfirm')
                    : isPrepaid
                      ? lang('GiftPayForUpgradeButton', { amount: formattedPriceElement }, { withNodes: true })
                      : lang('GiftUpgradeButton', { amount: formattedPriceElement }, { withNodes: true })}
                </div>
                {hasPriceDecreaseInfo && (
                  <div className={styles.priceDecreaseTimer}>
                    {lang('StarGiftPriceDecreaseTimer', {
                      timer: <TextTimer endsAt={nextPriceDate} onEnd={handleTimerEnd} />,
                    }, { withNodes: true })}
                  </div>
                )}
              </div>
            </Button>
            {hasPriceDecreaseInfo && (
              <Link
                className={styles.link}
                isPrimary
                onClick={handleOpenPriceInfo}
              >
                {lang('StarGiftPriceDecreaseInfoLink')}
              </Link>
            )}
          </>
        )}
      </div>
    );

    return {
      listItemData,
      header,
      footer,
    };
  }, [previewAttributes, isOpen, lang,
    renderingRecipient, renderingModal?.gift,
    shouldKeepOriginalDetails, isPrepaid,
    renderingModal?.prices?.length,
    nextPriceDate, formattedPriceElement]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={modalData?.header}
      footer={modalData?.footer}
      listItemData={modalData?.listItemData}
      hasBackdrop
      onClose={handleClose}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const recipientId = modal?.recipientId;
    const recipient = recipientId ? selectPeer(global, recipientId) : undefined;

    return {
      recipient,
    };
  },
)(GiftUpgradeModal));
