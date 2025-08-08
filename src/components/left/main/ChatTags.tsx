import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { selectChatFolder } from '../../../global/selectors';

import styles from './ChatTags.module.scss';

type OwnProps = {
  folderIds?: number[];
};

const ChatTags: FC<OwnProps> = ({
  folderIds,
}) => {
  const global = getGlobal();

  return (
    <div className={styles.wrapper}>
      {folderIds?.map((folderId) => {
        const folder = selectChatFolder(global, folderId);
        return folder && (
          <div key={folder.id} className={`${styles.tag} ${styles[`tagColor${folder.color}`]}`}>
            <div className={styles.tagBackground} />
            {folder.title.text}
          </div>
        );
      })}
    </div>
  );
};

export default memo(ChatTags);
