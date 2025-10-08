import { memo, useCallback } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { TabState } from '../../../../global/types';

import { formatShortDuration } from '../../../../util/dates/dateFormat';
import { getServerTime } from '../../../../util/serverTime';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Modal from '../../../ui/Modal';

import styles from './GiftLockedModal.module.scss';

export type OwnProps = {
  modal: TabState['lockedGiftModal'];
};

const GiftLockedModal = ({
  modal,
}: OwnProps) => {
  const { closeLockedGiftModal } = getActions();
  const lang = useLang();

  const handleClose = useLastCallback(() => {
    closeLockedGiftModal();
  });

  const getMessageText = useCallback(() => {
    if (!modal) return '';

    if (modal.untilDate) {
      const timeRemaining = modal.untilDate ? modal.untilDate - getServerTime() : 0;
      return lang('GiftLockedMessage', {
        relativeDate: formatShortDuration(lang, timeRemaining),
      },
      {
        withNodes: true,
        withMarkdown: true,
      });
    }

    if (modal.reason) {
      return renderTextWithEntities(modal.reason);
    }

    return lang('TitleGiftLocked');
  }, [modal, lang]);

  return (
    <Modal
      isOpen={Boolean(modal)}
      className="narrow"
      onClose={handleClose}
      title={lang('TitleGiftLocked')}
      headerClassName={styles.header}
    >
      <p className={styles.message}>
        {getMessageText()}
      </p>
      <Button
        onClick={handleClose}
      >
        {lang('OK')}
      </Button>
    </Modal>
  );
};

export default memo(GiftLockedModal);
