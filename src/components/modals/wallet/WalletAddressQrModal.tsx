import { memo } from '../../../lib/teact/teact';

import WalletReceiveScreen from './WalletReceiveScreen';
import Modal, { ModalCloseButton, ModalHeader, ModalTitle } from '@gili/modal/Modal';

import styles from './WalletAddressQrModal.module.scss';

type OwnProps = {
  isOpen: boolean;
  address: string;
  title: string;
  isPeer?: boolean;
  onClose: NoneToVoidFunction;
};

const WalletAddressQrModal = ({
  isOpen, address, title, isPeer, onClose,
}: OwnProps) => {
  return (
    <Modal
      isOpen={isOpen}
      header={(
        <ModalHeader className={styles.header} noMask>
          <ModalCloseButton className={styles.closeButton} />
          <ModalTitle>{title}</ModalTitle>
        </ModalHeader>
      )}
      width="slim"
      height="auto"
      dialogClassName={styles.dialog}
      noContentInlinePadding
      ariaLabel={title}
      onClose={onClose}
    >
      <WalletReceiveScreen address={address} isPeer={isPeer} />
    </Modal>
  );
};

export default memo(WalletAddressQrModal);
