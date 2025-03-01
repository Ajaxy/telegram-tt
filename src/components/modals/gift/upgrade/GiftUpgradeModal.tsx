import React, {
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

import { getPeerTitle, getStickerMediaHash } from '../../../../global/helpers';
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
  const { closeGiftUpgradeModal, upgradeGift } = getActions();
  const isOpen = Boolean(modal);

  const renderingModal = useCurrentOrPrev(modal);
  const renderingRecipient = useCurrentOrPrev(recipient);
  const [shouldKeepOriginalDetails, setShouldKeepOriginalDetails] = useState(false);

  const [previewAttributes, setPreviewAttributes] = useState<Attributes | undefined>();

  const lang = useLang();

  const handleClose = useLastCallback(() => closeGiftUpgradeModal());

  const handleUpgrade = useLastCallback(() => {
    const gift = renderingModal?.gift;
    if (!gift?.inputGift) return;

    upgradeGift({
      gift: gift.inputGift,
      shouldKeepOriginalDetails,
      upgradeStars: !gift.alreadyPaidUpgradeStars ? (gift.gift as ApiStarGiftRegular).upgradeStars : undefined,
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

    const listItemData = [
      ['diamond', lang('GiftUpgradeUniqueTitle'), lang('GiftUpgradeUniqueDescription')],
      ['trade', lang('GiftUpgradeTransferableTitle'), lang('GiftUpgradeTransferableDescription')],
      ['auction', lang('GiftUpgradeTradeableTitle'), lang('GiftUpgradeTradeableDescription')],
    ] satisfies TableAboutData;

    const subtitle = renderingRecipient
      ? lang('GiftPeerUpgradeText', { peer: getPeerTitle(lang, renderingRecipient) })
      : lang('GiftUpgradeTextOwn');

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
          <Button className={styles.footerButton} size="smaller" onClick={handleClose}>
            {lang('OK')}
          </Button>
        )}
        {gift && (
          <>
            <Checkbox
              label={lang('GiftUpgradeKeepDetails')}
              onCheck={setShouldKeepOriginalDetails}
              checked={shouldKeepOriginalDetails}
            />
            <Button className={styles.footerButton} size="smaller" isShiny onClick={handleUpgrade}>
              {gift.alreadyPaidUpgradeStars
                ? lang('GeneralConfirm')
                : lang('GiftUpgradeButton', {
                  amount: formatStarsAsIcon(lang, (gift.gift as ApiStarGiftRegular).upgradeStars!, { asFont: true }),
                }, { withNodes: true })}
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
  }, [previewAttributes, isOpen, lang, renderingRecipient, renderingModal?.gift, shouldKeepOriginalDetails]);

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
  (global, { modal }): StateProps => {
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
