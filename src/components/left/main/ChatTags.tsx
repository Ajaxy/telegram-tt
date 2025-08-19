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
  const MAX_VISIBLE_TAGS = 3;
  const visibleFolderIds = folderIds?.slice(0, MAX_VISIBLE_TAGS + 1) || []; // first tag is "all" and won't be shown
  const remainingCount = folderIds?.length ? folderIds.length - visibleFolderIds.length : 0;

  return (
    <div className={styles.wrapper}>
      {visibleFolderIds.map((folderId) => {
        const folder = chatFoldersById?.[folderId];
        return folder && (
          <div key={folder.id} className={`ChatTags ${styles.tag} ${styles[`tagColor${folder.color}`]}`}>
            <div className={styles.tagBackground} />
            {folder.title.text}
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div className={`ChatTags ${styles.tag} ${styles.tagColorMore}`}>
          <div className={styles.tagBackground} />
          +
          {remainingCount}
        </div>
      )}
    </div>
  );
};

export default memo(ChatTags);
