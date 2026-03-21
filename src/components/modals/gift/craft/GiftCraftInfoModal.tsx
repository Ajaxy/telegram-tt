import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { getGiftAttributes } from '../../../common/helpers/gifts';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import TableAboutModal, { type TableAboutData } from '../../common/TableAboutModal';
import UniqueGiftHeader from '../UniqueGiftHeader';

import styles from './GiftCraftInfoModal.module.scss';

export type OwnProps = {
  modal: TabState['giftCraftInfoModal'];
};

const GiftCraftInfoModal = ({
  modal,
}: OwnProps) => {
  const { closeGiftCraftInfoModal } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);
  const gift = renderingModal?.gift;

  const handleClose = useLastCallback(() => {
    closeGiftCraftInfoModal();
  });

  const giftAttributes = useMemo(() => {
    return gift ? getGiftAttributes(gift) : undefined;
  }, [gift]);

  const header = useMemo(() => {
    if (!giftAttributes) return undefined;

    return (
      <UniqueGiftHeader
        className={styles.header}
        modelAttribute={giftAttributes.model!}
        backdropAttribute={giftAttributes.backdrop!}
        patternAttribute={giftAttributes.pattern!}
        title={lang('GiftCraftInfoTitle')}
        subtitle={lang('GiftCraftInfoSubtitle')}
      />
    );
  }, [giftAttributes, lang]);

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
    return [
      ['radial-badge', lang('GiftCraftInfoCraftTitle'), lang('GiftCraftInfoCraftDescription')],
      ['combine-craft', lang('GiftCraftInfoChanceTitle'), lang('GiftCraftInfoChanceDescription')],
      ['boost-craft-chance', lang('GiftCraftInfoRiskTitle'), lang('GiftCraftInfoRiskDescription')],
    ] satisfies TableAboutData;
  }, [lang]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      header={header}
      listItemData={listItemData}
      footer={footer}
      hasBackdrop
      contentClassName={styles.content}
      onClose={handleClose}
    />
  );
};

export default memo(GiftCraftInfoModal);
