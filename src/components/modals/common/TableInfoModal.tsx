import React, { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer, ApiWebDocument } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PickerSelectedItem from '../../common/PickerSelectedItem';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './TableInfoModal.module.scss';

type ChatItem = { chatId: string };

export type TableData = [TeactNode, TeactNode | ChatItem][];

type OwnProps = {
  isOpen?: boolean;
  title?: string;
  tableData?: TableData;
  headerImageUrl?: string;
  headerAvatarPeer?: ApiPeer | CustomPeer;
  headerAvatarWebPhoto?: ApiWebDocument;
  noHeaderImage?: boolean;
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
  headerImageUrl,
  headerAvatarPeer,
  headerAvatarWebPhoto,
  noHeaderImage,
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

  const withAvatar = Boolean(headerAvatarPeer || headerAvatarWebPhoto);

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
      {!noHeaderImage && (
        withAvatar ? (
          <Avatar peer={headerAvatarPeer} webPhoto={headerAvatarWebPhoto} size="jumbo" className={styles.avatar} />
        ) : (
          <img className={styles.logo} src={headerImageUrl} alt="" draggable={false} />
        )
      )}
      {header}
      <table className={styles.table}>
        {tableData?.map(([label, value]) => (
          <tr className={styles.row}>
            <td className={buildClassName(styles.cell, styles.title)}>{label}</td>
            <td className={buildClassName(styles.cell, styles.value)}>
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
            </td>
          </tr>
        ))}
      </table>
      {footer}
      {buttonText && (
        <Button onClick={onButtonClick || onClose}>{buttonText}</Button>
      )}
    </Modal>
  );
};

export default memo(TableInfoModal);
