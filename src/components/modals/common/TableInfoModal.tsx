import React, { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiPeer, ApiWebDocument } from '../../../api/types';
import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../../common/Avatar';
import PickerSelectedItem from '../../common/pickers/PickerSelectedItem';
import Button from '../../ui/Button';
import Modal from '../../ui/Modal';

import styles from './TableInfoModal.module.scss';

import StarsBackground from '../../../assets/stars-bg.png';

type ChatItem = { chatId: string };

export type TableData = [TeactNode, TeactNode | ChatItem][];

type OwnProps = {
  isOpen?: boolean;
  title?: string;
  tableData?: TableData;
  headerImageUrl?: string;
  logoBackground?: string;
  headerAvatarPeer?: ApiPeer | CustomPeer;
  headerAvatarWebPhoto?: ApiWebDocument;
  noHeaderImage?: boolean;
  isGift?: boolean;
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
  logoBackground,
  headerAvatarPeer,
  headerAvatarWebPhoto,
  noHeaderImage,
  isGift,
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
      {!isGift && !noHeaderImage && (
        withAvatar ? (
          <Avatar peer={headerAvatarPeer} webPhoto={headerAvatarWebPhoto} size="jumbo" className={styles.avatar} />
        ) : (
          <div className={styles.section}>
            <img className={styles.logo} src={headerImageUrl} alt="" draggable={false} />
            {Boolean(logoBackground)
              && <img className={styles.logoBackground} src={StarsBackground} alt="" draggable={false} />}
          </div>
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
        <Button size="smaller" onClick={onButtonClick || onClose}>{buttonText}</Button>
      )}
    </Modal>
  );
};

export default memo(TableInfoModal);
