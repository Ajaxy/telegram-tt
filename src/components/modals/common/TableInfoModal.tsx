import React, { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PickerSelectedItem from '../../common/pickers/PickerSelectedItem';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './TableInfoModal.module.scss';

type ChatItem = { chatId: string };

export type TableData = [TeactNode, TeactNode | ChatItem][];

type OwnProps = {
  isOpen?: boolean;
  title?: string;
  tableData?: TableData;
  headerAvatarPeer?: ApiPeer | CustomPeer;
  header?: TeactNode;
  footer?: TeactNode;
  buttonText?: string;
  className?: string;
  onClose: NoneToVoidFunction;
  onButtonClick?: NoneToVoidFunction;
};

const TableInfoModal = ({
  isOpen,
  title,
  tableData,
  headerAvatarPeer,
  header,
  footer,
  buttonText,
  className,
  onClose,
  onButtonClick,
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
      isSlim
      title={title}
      className={className}
      contentClassName={styles.content}
      onClose={onClose}
    >
      {headerAvatarPeer && (
        <Avatar peer={headerAvatarPeer} size="jumbo" className={styles.avatar} />
      )}
      {header}
      <div className={styles.table}>
        {tableData?.map(([label, value]) => (
          <>
            <div className={buildClassName(styles.cell, styles.title)}>{label}</div>
            <div className={buildClassName(styles.cell, styles.value)}>
              {typeof value === 'object' && 'chatId' in value ? (
                <PickerSelectedItem
                  peerId={value.chatId}
                  className={styles.chatItem}
                  forceShowSelf
                  fluid
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
        <Button size="smaller" onClick={onButtonClick || onClose}>{buttonText}</Button>
      )}
    </Modal>
  );
};

export default memo(TableInfoModal);
