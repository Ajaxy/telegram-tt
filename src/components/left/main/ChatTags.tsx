import type { FC } from '../../../lib/teact/teact';
import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import { ALL_FOLDER_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { getApiPeerColorClass } from '../../common/helpers/peerColor';

import styles from './ChatTags.module.scss';

type OwnProps = {
  folderIds?: number[];
  orderedIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
  activeChatFolder?: number;
};

const ChatTags: FC<OwnProps> = ({
  folderIds,
  orderedIds,
  chatFoldersById,
  activeChatFolder,
}) => {
  const MAX_VISIBLE_TAGS = 3;

  const activeFolderId = activeChatFolder !== undefined && orderedIds ? orderedIds[activeChatFolder] : undefined;

  const orderedFolderIds = orderedIds?.filter((id) =>
    folderIds?.includes(id) && id !== activeFolderId && id !== ALL_FOLDER_ID,
  ) || [];

  const visibleFolderIds = orderedFolderIds.slice(0, MAX_VISIBLE_TAGS);
  const remainingCount = orderedFolderIds.length - visibleFolderIds.length;

  return (
    <div className={styles.wrapper}>
      {visibleFolderIds.map((folderId) => {
        const folder = chatFoldersById?.[folderId];
        return folder && (
          <div
            key={folder.id}
            className={buildClassName(
              'ChatTags',
              styles.tag,
              getApiPeerColorClass({ color: folder.color }),
            )}
          >
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
