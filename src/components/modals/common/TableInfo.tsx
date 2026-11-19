import { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { CustomPeer } from '../../../types';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import PeerChip from '../../common/PeerChip';

import styles from './TableInfo.module.scss';

type ChatItem = { chatId: string; withEmojiStatus?: boolean };
type CustomPeerItem = { customPeer: CustomPeer };
type TableValue = TeactNode | ChatItem | CustomPeerItem;

export type TableData = [TeactNode | undefined, TableValue][];

type OwnProps = {
  tableData?: TableData;
  className?: string;
  onChatClick?: (peerId: string) => void;
};

const TableInfo = ({
  tableData,
  className,
  onChatClick,
}: OwnProps) => {
  const { openChat } = getActions();

  const handleOpenChat = useLastCallback((peerId: string) => {
    if (onChatClick) {
      onChatClick(peerId);
    } else {
      openChat({ id: peerId });
    }
  });

  if (!tableData?.length) {
    return undefined;
  }

  function renderValue(value: TableValue) {
    if (typeof value === 'object' && 'chatId' in value) {
      return (
        <PeerChip
          peerId={value.chatId}
          className={styles.chatItem}
          forceShowSelf
          withEmojiStatus={value.withEmojiStatus}
          clickArg={value.chatId}
          onClick={handleOpenChat}
        />
      );
    }

    if (typeof value === 'object' && 'customPeer' in value) {
      return (
        <PeerChip
          customPeer={value.customPeer}
          className={buildClassName(styles.chatItem, styles.customPeerItem)}
        />
      );
    }

    return value;
  }

  return (
    <div className={buildClassName(styles.table, className)}>
      {tableData.map(([label, value]) => (
        <>
          {Boolean(label) && <div className={buildClassName(styles.cell, styles.title)}>{label}</div>}
          <div className={buildClassName(styles.cell, styles.value, !label && styles.fullWidth)}>
            {renderValue(value)}
          </div>
        </>
      ))}
    </div>
  );
};

export default memo(TableInfo);
