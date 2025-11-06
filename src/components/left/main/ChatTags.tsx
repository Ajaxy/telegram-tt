import { memo } from '../../../lib/teact/teact';

import type { ApiChatFolder } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import { getPeerColorClass } from '../../../hooks/usePeerColor';

import styles from './ChatTags.module.scss';

const MAX_VISIBLE_TAGS = 3;
const CUSTOM_EMOJI_SIZE = 0.875 * REM;

type OwnProps = {
  orderedFolderIds?: number[];
  chatFoldersById?: Record<number, ApiChatFolder>;
  itemClassName?: string;
};

const ChatTags = ({
  orderedFolderIds,
  chatFoldersById,
  itemClassName,
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
              styles.tag,
              folder.color !== undefined && folder.color !== -1 && getPeerColorClass(folder.color),
              itemClassName,
            )}
          >
            {renderTextWithEntities({
              text: folder.title.text,
              entities: folder.title.entities,
              noCustomEmojiPlayback: folder.noTitleAnimations,
              emojiSize: CUSTOM_EMOJI_SIZE,
            })}
          </div>
        );
      })}
      {remainingCount > 0 && (
        <div className={buildClassName(styles.tag, styles.tagColorMore, itemClassName)}>
          +
          {remainingCount}
        </div>
      )}
    </div>
  );
};

export default memo(ChatTags);
