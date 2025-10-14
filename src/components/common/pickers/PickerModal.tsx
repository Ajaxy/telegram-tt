import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';
import Modal, { type OwnProps as ModalProps } from '../../ui/Modal';

import styles from './PickerModal.module.scss';

type OwnProps = {
  confirmButtonText?: string;
  isConfirmDisabled?: boolean;
  shouldAdaptToSearch?: boolean;
  withFixedHeight?: boolean;
  withPremiumGradient?: boolean;
  onConfirm?: NoneToVoidFunction;
} & ModalProps;

const PickerModal = ({
  confirmButtonText,
  isConfirmDisabled,
  shouldAdaptToSearch,
  withFixedHeight,
  onConfirm,
  withPremiumGradient,
  ...modalProps
}: OwnProps) => {
  const lang = useOldLang();
  const hasButton = Boolean(confirmButtonText || onConfirm);

  return (
    <Modal
      {...modalProps}
      isSlim
      className={buildClassName(
        shouldAdaptToSearch && styles.withSearch,
        withFixedHeight && styles.fixedHeight,
        modalProps.className,
      )}
      contentClassName={buildClassName(styles.content, modalProps.contentClassName)}
      headerClassName={buildClassName(styles.header, modalProps.headerClassName)}
      isCondensedHeader
    >
      {modalProps.children}
      {hasButton && (
        <div className={styles.buttonWrapper}>
          <Button
            withPremiumGradient={withPremiumGradient}
            onClick={onConfirm || modalProps.onClose}
            color="primary"
            disabled={isConfirmDisabled}
          >
            {confirmButtonText || lang('Confirm')}
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default memo(PickerModal);
