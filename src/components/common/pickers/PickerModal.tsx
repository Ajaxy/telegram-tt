import { memo, useRef } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useOldLang from '../../../hooks/useOldLang';
import useScrollNotch from '../../../hooks/useScrollNotch';

import Button from '../../ui/Button';
import Modal, { type OwnProps as ModalProps } from '../../ui/Modal';

import styles from './PickerModal.module.scss';
import pickerStyles from './PickerStyles.module.scss';

type OwnProps = {
  confirmButtonText?: string;
  isConfirmDisabled?: boolean;
  shouldAdaptToSearch?: boolean;
  withFixedHeight?: boolean;
  withPremiumGradient?: boolean;
  itemsContainerSelector?: string;
  onConfirm?: NoneToVoidFunction;
} & ModalProps;

const DEFAULT_ITEMS_CONTAINER_SELECTOR = `.${pickerStyles.pickerList}`;

const PickerModal = ({
  confirmButtonText,
  isConfirmDisabled,
  shouldAdaptToSearch,
  withFixedHeight,
  onConfirm,
  withPremiumGradient,
  itemsContainerSelector = DEFAULT_ITEMS_CONTAINER_SELECTOR,
  ...modalProps
}: OwnProps) => {
  const lang = useOldLang();
  const hasButton = Boolean(confirmButtonText || onConfirm);

  const dialogRef = useRef<HTMLDivElement>();

  useScrollNotch({
    containerRef: dialogRef,
    selector: `.modal-content ${itemsContainerSelector}`,
    isBottomNotch: true,
    shouldHideTopNotch: true,
  }, [modalProps.isOpen]);

  return (
    <Modal
      {...modalProps}
      dialogRef={dialogRef}
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
