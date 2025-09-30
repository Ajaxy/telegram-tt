import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { getApiPeerColorClass } from '../../common/helpers/peerColor';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import styles from './ChatTags.module.scss';

const MAX_VISIBLE_TAGS = 3;

type OwnProps = {
  orderedFolderIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
};

const ChatTags = ({
  orderedFolderIds,
  chatFoldersById,
}: OwnProps) => {
  if (!orderedFolderIds) {
    return undefined;
  }

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
