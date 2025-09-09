import { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PeerChip from '../../common/PeerChip';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './TableInfoModal.module.scss';

type ChatItem = { chatId: string; withEmojiStatus?: boolean };

export type TableData = [TeactNode | undefined, TeactNode | ChatItem][];

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
  hasBackdrop?: boolean;
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
  hasBackdrop,
  onClose,
  onButtonClick,
  withBalanceBar,
  isLowStackPriority,
  currencyInBalanceBar,
}: OwnProps) => {
  const { openChat } = getActions();
  const handleOpenChat = useLastCallback((peerId: string) => {
    openChat({ id: peerId });
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton={Boolean(title)}
      hasAbsoluteCloseButton={!title}
      absoluteCloseButtonColor={hasBackdrop ? 'translucent-white' : undefined}
      isSlim
      header={modalHeader}
      title={title}
      className={className}
      contentClassName={buildClassName(styles.content, contentClassName)}
      onClose={onClose}
      withBalanceBar={withBalanceBar}
      currencyInBalanceBar={currencyInBalanceBar}
      isLowStackPriority={isLowStackPriority}
    >
      {headerAvatarPeer && (
        <Avatar peer={headerAvatarPeer} size="jumbo" className={styles.avatar} />
      )}
      {header}
      <div className={styles.table}>
        {tableData?.map(([label, value]) => (
          <>
            {Boolean(label) && <div className={buildClassName(styles.cell, styles.title)}>{label}</div>}
            <div className={buildClassName(styles.cell, styles.value, !label && styles.fullWidth)}>
              {typeof value === 'object' && 'chatId' in value ? (
                <PeerChip
                  peerId={value.chatId}
                  className={styles.chatItem}
                  forceShowSelf
                  withEmojiStatus={value.withEmojiStatus}
                  clickArg={value.chatId}
                  onClick={handleOpenChat}
                />
              ) : value}
            </div>
          </>
        ))}
      </div>
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
