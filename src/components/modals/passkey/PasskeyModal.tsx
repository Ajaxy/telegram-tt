import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TabState } from '../../../global/types';

import { LOCAL_TGS_PREVIEW_URLS, LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../common/AnimatedIconWithPreview';
import TableAboutModal, { type TableAboutData } from '../common/TableAboutModal';

import styles from './PasskeyModal.module.scss';

export type OwnProps = {
  modal: TabState['isPasskeyModalOpen'];
};

const TOP_STICKER_SIZE = 120;

const PasskeyModal = ({
  modal,
}: OwnProps) => {
  const { closePasskeyModal, startPasskeyRegistration } = getActions();

  const lang = useLang();

  const handleClose = useLastCallback(() => {
    closePasskeyModal();
  });

  const handleCreatePasskey = useLastCallback(() => {
    startPasskeyRegistration();
    handleClose();
  });

  const modalData = useMemo(() => {
    const header = (
      <div className="flex-column-centered">
        <AnimatedIconWithPreview
          tgsUrl={LOCAL_TGS_URLS.Passkeys}
          previewUrl={LOCAL_TGS_PREVIEW_URLS.Passkeys}
          size={TOP_STICKER_SIZE}
        />
        <h3 className={styles.title}>{lang('PasskeyModalTitle')}</h3>
        <p>{lang('PasskeyModalDescription')}</p>
      </div>
    );

    const listItemData: TableAboutData = [
      ['key', lang('PasskeyModalFeature1Title'),
        lang('PasskeyModalFeature1Description')],
      ['animals', lang('PasskeyModalFeature2Title'),
        lang('PasskeyModalFeature2Description')],
      ['lock', lang('PasskeyModalFeature3Title'),
        lang('PasskeyModalFeature3Description')],
    ];

    return {
      header,
      listItemData,
    };
  }, [lang]);

  return (
    <TableAboutModal
      isOpen={Boolean(modal)}
      listItemData={modalData.listItemData}
      header={modalData.header}
      buttonText={lang('PasskeyModalButtonText')}
      onButtonClick={handleCreatePasskey}
      onClose={handleClose}
    />
  );
};

export default memo(PasskeyModal);
