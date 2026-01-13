import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Sparkles from '../../common/Sparkles';
import PremiumFeaturePreviewVideo from '../../main/premium/previews/PremiumFeaturePreviewVideo';
import Button from '../../ui/Button';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './AboutStarGiftModal.module.scss';

export type OwnProps = {
  modal: TabState['aboutStarGiftModal'];
};

const AboutStarGiftModal = ({
  modal,
}: OwnProps) => {
  const { closeAboutStarGiftModal } = getActions();
  const lang = useLang();

  const isOpen = Boolean(modal);
  const renderingModal = useCurrentOrPrev(modal);

  const handleClose = useLastCallback(() => {
    closeAboutStarGiftModal();
  });

  const header = useMemo(() => {
    return (
      <div className={styles.header}>
        <div className={styles.videoPreviewWrapper}>
          <Sparkles preset="progress" className={styles.sparkles} />
          <PremiumFeaturePreviewVideo
            videoId={renderingModal?.videoId}
            videoThumbnail={renderingModal?.videoThumbnail}
            isActive={isOpen}
            isDown
          />
        </div>
        <div className={styles.title}>
          {lang('StarGiftInfoTitle')}
        </div>
        <div className={styles.subtitle}>
          {lang('StarGiftInfoSubtitle')}
        </div>
      </div>
    );
  }, [lang, renderingModal, isOpen]);

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
      ['diamond', lang('StarGiftInfoUniqueTitle'), lang('StarGiftInfoUniqueSubtitle')],
      ['auction', lang('StarGiftInfoTradableTitle'), lang('StarGiftInfoTradableSubtitle')],
      ['crown-wear-outline', lang('StarGiftInfoWearableTitle'), lang('StarGiftInfoWearableSubtitle')],
    ] satisfies TableAboutData;
  }, [lang]);

  return (
    <TableAboutModal
      isOpen={isOpen}
      contentClassName={styles.content}
      header={header}
      listItemData={listItemData}
      footer={footer}
      hasBackdrop={Boolean(renderingModal?.videoId)}
      absoluteCloseButtonColor="translucent-white"
      onClose={handleClose}
    />
  );
};

export default memo(AboutStarGiftModal);
