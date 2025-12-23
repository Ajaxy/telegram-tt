import { memo, type TeactNode } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import PeerChip from '../../common/PeerChip';

import styles from './TableInfo.module.scss';

type ChatItem = { chatId: string; withEmojiStatus?: boolean };

export type TableData = [TeactNode | undefined, TeactNode | ChatItem][];

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

  return (
    <div className={buildClassName(styles.table, className)}>
      {tableData.map(([label, value]) => (
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
  );
};

export default memo(TableInfo);
