import React, { memo, useMemo } from '../../../lib/teact/teact';

import type { FC } from '../../../lib/teact/teact';
import type { ApiAttachment } from '../../../api/types';

import { SUPPORTED_IMAGE_CONTENT_TYPES, SUPPORTED_VIDEO_CONTENT_TYPES } from '../../../config';
import { getFileExtension } from '../../common/helpers/documentInfo';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dateFormat';

import File from '../../common/File';

import styles from './AttachmentModalItem.module.scss';

type OwnProps = {
  attachment: ApiAttachment;
  className?: string;
  shouldDisplayCompressed?: boolean;
  shouldDisplayGrouped?: boolean;
  isSingle?: boolean;
  index: number;
  onDelete?: (index: number) => void;
};

const AttachmentModalItem: FC<OwnProps> = ({
  attachment,
  className,
  isSingle,
  shouldDisplayCompressed,
  shouldDisplayGrouped,
  index,
  onDelete,
}) => {
  const displayType = getDisplayType(attachment, shouldDisplayCompressed);

  const content = useMemo(() => {
    switch (displayType) {
      case 'image':
        return (
          <img
            className={styles.preview}
            src={attachment.blobUrl}
            alt=""
            draggable={false}
          />
        );
      case 'video':
        return (
          <>
            {Boolean(attachment.quick?.duration) && (
              <div className={styles.duration}>{formatMediaDuration(attachment.quick!.duration)}</div>
            )}
            <video
              className={styles.preview}
              src={attachment.blobUrl}
              autoPlay
              muted
              loop
              disablePictureInPicture
            />
          </>
        );
      default:
        return (
          <>
            <File
              className={styles.file}
              name={attachment.filename}
              extension={getFileExtension(attachment.filename, attachment.mimeType)}
              previewData={attachment.previewBlobUrl}
              size={attachment.size}
              smaller
            />
            {onDelete && (
              <i
                className={buildClassName('icon-delete', styles.actionItem, styles.deleteFile)}
                onClick={() => onDelete(index)}
              />
            )}
          </>
        );
    }
  }, [attachment, displayType, index, onDelete]);

  const shouldSkipGrouping = displayType === 'file' || !shouldDisplayGrouped;
  const shouldRenderOverlay = displayType !== 'file' && onDelete;

  const rootClassName = buildClassName(
    className, styles.root, isSingle && styles.single, shouldSkipGrouping && styles.noGrouping,
  );

  return (
    <div className={rootClassName}>
      {shouldRenderOverlay && (
        <div className={styles.overlay}>
          {onDelete && (
            <i className={buildClassName('icon-delete', styles.actionItem)} onClick={() => onDelete(index)} />
          )}
        </div>
      )}
      {content}
    </div>
  );
};

function getDisplayType(attachment: ApiAttachment, shouldDisplayCompressed?: boolean) {
  if (shouldDisplayCompressed && attachment.quick) {
    if (SUPPORTED_IMAGE_CONTENT_TYPES.has(attachment.mimeType)) {
      return 'image';
    }
    if (SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType)) {
      return 'video';
    }
  }
  return 'file';
}

export default memo(AttachmentModalItem);
