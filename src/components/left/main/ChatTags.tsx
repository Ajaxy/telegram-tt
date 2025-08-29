import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import { ALL_FOLDER_ID } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { getApiPeerColorClass } from '../../common/helpers/peerColor';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import styles from './ChatTags.module.scss';

const MAX_VISIBLE_TAGS = 3;

type OwnProps = {
  folderIds?: number[];
  orderedIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
  activeChatFolder?: number;
};

const ChatTags = ({
  folderIds,
  orderedIds,
  chatFoldersById,
  activeChatFolder,
}: OwnProps) => {
  const activeFolderId = activeChatFolder !== undefined && orderedIds ? orderedIds[activeChatFolder] : undefined;

  const orderedFolderIds = useMemo(() => orderedIds?.filter((id) => {
    const isFolder = folderIds?.includes(id);
    const isActive = id === activeFolderId;
    const isAll = id === ALL_FOLDER_ID;

    const folder = chatFoldersById?.[id];
    const hasColor = folder?.color !== undefined && folder.color !== -1;

    return isFolder && !isActive && !isAll && hasColor;
  }) || [], [orderedIds, folderIds, activeFolderId, chatFoldersById]);

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
            {renderTextWithEntities({
              text: folder.title.text,
              entities: folder.title.entities,
              noCustomEmojiPlayback: folder.noTitleAnimations,
              emojiSize: 12,
            })}
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div className={`ChatTags ${styles.tag} ${styles.tagColorMore}`}>
          +
          {remainingCount}
        </div>
      )}
    </div>
  );
};

export default memo(ChatTags);
