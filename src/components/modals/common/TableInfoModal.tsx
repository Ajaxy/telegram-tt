import { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';
import TableInfo, { type TableData } from './TableInfo';

import styles from './TableInfoModal.module.scss';

export type { TableData };

type OwnProps = {
  isOpen?: boolean;
  title?: string;
  tableData?: TableData;
  headerAvatarPeer?: ApiPeer | CustomPeer;
  header?: TeactNode;
  modalHeader?: TeactNode;
  footer?: TeactNode;
  buttonText?: string;
  className?: string;
  contentClassName?: string;
  tableClassName?: string;
  hasBackdrop?: boolean;
  closeButtonColor?: 'translucent' | 'translucent-white';
  moreMenuItems?: TeactNode;
  onClose: NoneToVoidFunction;
  onButtonClick?: NoneToVoidFunction;
  withBalanceBar?: boolean;
  currencyInBalanceBar?: 'TON' | 'XTR';
  isLowStackPriority?: true;
};

const TableInfoModal = ({
  isOpen,
  title,
  tableData,
  headerAvatarPeer,
  header,
  modalHeader,
  footer,
  buttonText,
  className,
  contentClassName,
  tableClassName,
  hasBackdrop,
  closeButtonColor,
  moreMenuItems,
  onClose,
  onButtonClick,
  withBalanceBar,
  isLowStackPriority,
  currencyInBalanceBar,
}: OwnProps) => {
  const { openChat } = getActions();

  const handleChatClick = useLastCallback((peerId: string) => {
    openChat({ id: peerId });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton={Boolean(title)}
      hasAbsoluteCloseButton={!title}
      absoluteCloseButtonColor={closeButtonColor || (hasBackdrop ? 'translucent-white' : undefined)}
      isSlim
      header={modalHeader}
      title={title}
      className={className}
      contentClassName={buildClassName(styles.content, contentClassName)}
      moreMenuItems={moreMenuItems}
      onClose={onClose}
      withBalanceBar={withBalanceBar}
      currencyInBalanceBar={currencyInBalanceBar}
      isLowStackPriority={isLowStackPriority}
    >
      {headerAvatarPeer && (
        <Avatar peer={headerAvatarPeer} size="jumbo" className={styles.avatar} />
      )}
      {header}
      <TableInfo tableData={tableData} className={tableClassName} onChatClick={handleChatClick} />
      {footer}
      {buttonText && (
        <Button
          className={!footer ? styles.noFooter : undefined}
          onClick={onButtonClick || onClose}
        >
          {buttonText}
        </Button>
      )}
    </Modal>
  );
};

export default memo(TableInfoModal);
