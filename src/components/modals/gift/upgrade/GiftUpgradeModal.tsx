import {
  memo, useEffect, useMemo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiPeer,
  ApiStarGiftAttribute,
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeModel,
  ApiStarGiftAttributePattern,
  ApiStarGiftRegular,
} from '../../../../api/types';
import type { TabState } from '../../../../global/types';
import { ApiMediaFormat } from '../../../../api/types';

import { getStickerMediaHash } from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { formatStarsAsIcon } from '../../../../util/localization/format';
import { fetch } from '../../../../util/mediaLoader';

import useInterval from '../../../../hooks/schedulers/useInterval';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Checkbox from '../../../ui/Checkbox';
import TableAboutModal, { type TableAboutData } from '../../common/TableAboutModal';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftUpgradeModal.module.scss';

export type OwnProps = {
  modal: TabState['giftUpgradeModal'];
};

type StateProps = {
  recipient?: ApiPeer;
};

type Attributes = {
  model: ApiStarGiftAttributeModel;
  pattern: ApiStarGiftAttributePattern;
  backdrop: ApiStarGiftAttributeBackdrop;
};

const PREVIEW_UPDATE_INTERVAL = 3000;

const GiftUpgradeModal = ({ modal, recipient }: OwnProps & StateProps) => {
  const { closeGiftUpgradeModal, closeGiftInfoModal, upgradeGift, upgradePrepaidGift } = getActions();
  const isOpen = Boolean(modal);

  const renderingModal = useCurrentOrPrev(modal);
  const renderingRecipient = useCurrentOrPrev(recipient);
  const [shouldKeepOriginalDetails, setShouldKeepOriginalDetails] = useState(false);

  const isPrepaid = Boolean(renderingModal?.gift?.prepaidUpgradeHash);

  const [previewAttributes, setPreviewAttributes] = useState<Attributes | undefined>();

  const lang = useLang();

  const handleClose = useLastCallback(() => closeGiftUpgradeModal());

  const handleUpgrade = useLastCallback(() => {
    const gift = renderingModal?.gift;

    if (!gift) return;

    const regularGift = gift.gift.type === 'starGift' ? gift.gift : undefined;

    if (isPrepaid && gift.prepaidUpgradeHash && renderingRecipient) {
      const upgradeStars = regularGift?.upgradeStars;
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
      upgradeStars: !gift.alreadyPaidUpgradeStars ? regularGift?.upgradeStars : undefined,
    });
    handleClose();
  });

  const updatePreviewAttributes = useLastCallback(() => {
    if (!renderingModal?.sampleAttributes) return;
    setPreviewAttributes(getRandomAttributes(renderingModal.sampleAttributes, previewAttributes));
  });

  useInterval(updatePreviewAttributes, isOpen ? PREVIEW_UPDATE_INTERVAL : undefined, true);

  useEffect(() => {
    if (isOpen && renderingModal?.sampleAttributes) {
      updatePreviewAttributes();
    }
  }, [isOpen, renderingModal?.sampleAttributes]);

  // Preload stickers and patterns
  useEffect(() => {
    const attributes = renderingModal?.sampleAttributes;
    if (!attributes) return;
    const patternStickers = attributes.filter((attr): attr is ApiStarGiftAttributeModel => attr.type === 'pattern')
      .map((attr) => attr.sticker);
    const modelStickers = attributes.filter((attr): attr is ApiStarGiftAttributeModel => attr.type === 'model')
      .map((attr) => attr.sticker);

    const mediaHashes = [...patternStickers, ...modelStickers].map((sticker) => getStickerMediaHash(sticker, 'full'));
    mediaHashes.forEach((hash) => {
      fetch(hash, ApiMediaFormat.BlobUrl);
    });
  }, [renderingModal?.sampleAttributes]);

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

    const formattedPrice = gift
      ? formatStarsAsIcon(lang, (gift.gift as ApiStarGiftRegular).upgradeStars!, { asFont: true })
      : undefined;

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
              {gift.alreadyPaidUpgradeStars
                ? lang('GeneralConfirm')
                : isPrepaid
                  ? lang('GiftPayForUpgradeButton', { amount: formattedPrice }, { withNodes: true })
                  : lang('GiftUpgradeButton', { amount: formattedPrice }, { withNodes: true })}
            </Button>
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
    shouldKeepOriginalDetails, isPrepaid]);

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

function getRandomAttributes(list: ApiStarGiftAttribute[], previousSelection?: Attributes): Attributes {
  const models = list.filter((attr): attr is ApiStarGiftAttributeModel => (
    attr.type === 'model' && attr.name !== previousSelection?.model.name
  ));
  const patterns = list.filter((attr): attr is ApiStarGiftAttributePattern => (
    attr.type === 'pattern' && attr.name !== previousSelection?.pattern.name
  ));
  const backdrops = list.filter((attr): attr is ApiStarGiftAttributeBackdrop => (
    attr.type === 'backdrop' && attr.name !== previousSelection?.backdrop.name
  ));

  const randomModel = models[Math.floor(Math.random() * models.length)];
  const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
  const randomBackdrop = backdrops[Math.floor(Math.random() * backdrops.length)];

  return {
    model: randomModel,
    pattern: randomPattern,
    backdrop: randomBackdrop,
  };
}
