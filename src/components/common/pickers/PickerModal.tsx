import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Modal, { type OwnProps as ModalProps } from '../../ui/Modal';

import styles from './PickerModal.module.scss';

type OwnProps = {
  confirmButtonText?: string;
  isConfirmDisabled?: boolean;
  withFixedHeight?: boolean;
  withPremiumGradient?: boolean;
  onConfirm?: NoneToVoidFunction;
} & ModalProps;

const PickerModal = ({
  confirmButtonText,
  isConfirmDisabled,
  withFixedHeight,
  onConfirm,
  withPremiumGradient,
  ...modalProps
}: OwnProps) => {
  const lang = useLang();
  const hasButton = Boolean(confirmButtonText || onConfirm);

  return (
    <Modal
      {...modalProps}
      isSlim
      className={buildClassName(
        styles.islands,
        withFixedHeight && styles.fixedHeight,
        modalProps.className,
      )}
      contentClassName={buildClassName(styles.content, modalProps.contentClassName)}
      headerClassName={buildClassName('modal-header-condensed-wide', modalProps.headerClassName)}
    >
      {modalProps.children}
      {hasButton && (
        <div className={styles.buttonWrapper}>
          <Button
            className={styles.confirmButton}
            withPremiumGradient={withPremiumGradient}
            onClick={onConfirm || modalProps.onClose}
            color="primary"
            disabled={isConfirmDisabled}
          >
            {confirmButtonText || lang('GeneralConfirm')}
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default memo(PickerModal);
