import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import styles from './ChatTags.module.scss';

type OwnProps = {
  folderIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
};

const ChatTags: FC<OwnProps> = ({
  folderIds,
  chatFoldersById,
}) => {
  return (
    <div className={styles.wrapper}>
      {folderIds?.map((folderId) => {
        const folder = chatFoldersById?.[folderId];
        return folder && (
          <div key={folder.id} className={`ChatTags ${styles.tag} ${styles[`tagColor${folder.color}`]}`}>
            <div className={styles.tagBackground} />
            {folder.title.text}
          </div>
        );
      })}
    </div>
  );
};

export default memo(ChatTags);
