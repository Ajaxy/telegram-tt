import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import styles from './ChatTags.module.scss';

type OwnProps = {
  folderIds?: number[];
};

type StateProps = {
  chatFoldersById: Record<number, any>; // Replace 'any' with proper folder type if available
};

const ChatTags: FC<OwnProps & StateProps> = ({
  folderIds,
  chatFoldersById,
}) => {
  return (
    <div className={styles.wrapper}>
      {folderIds?.map((folderId) => {
        const folder = chatFoldersById[folderId];
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

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      chatFoldersById: global.chatFolders.byId,
    };
  },
)(ChatTags));
