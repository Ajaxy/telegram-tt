import { memo, useMemo, useState } from '../../../lib/teact/teact';

import type { ApiAttachment } from '../../../api/types';

import { SUPPORTED_PHOTO_CONTENT_TYPES, SUPPORTED_VIDEO_CONTENT_TYPES } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dates/duration';
import { getFileExtension } from '../../common/helpers/documentInfo';
import { REM } from '../../common/helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AttachmentAudio from '../../common/AttachmentAudio';
import File from '../../common/File';
import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';

import styles from './AttachmentModalItem.module.scss';

type OwnProps = {
  attachment: ApiAttachment;
  className?: string;
  shouldDisplayCompressed?: boolean;
  shouldDisplayGrouped?: boolean;
  isSingle?: boolean;
  index: number;
  onDelete?: (index: number) => void;
  onToggleSpoiler?: (index: number) => void;
  onEdit?: (index: number) => void;
};

const BLUR_CANVAS_SIZE = 15 * REM;

const AttachmentModalItem = ({
  attachment,
  className,
  isSingle,
  shouldDisplayCompressed,
  shouldDisplayGrouped,
  index,
  onDelete,
  onToggleSpoiler,
  onEdit,
}: OwnProps) => {
  const lang = useLang();
  const { isMobile } = useAppLayout();
  const [isAudioBroken, setIsAudioBroken] = useState(false);
  const displayType = isAudioBroken ? 'file' : getDisplayType(attachment, shouldDisplayCompressed);

  const handleSpoilerClick = useLastCallback(() => {
    onToggleSpoiler?.(index);
  });

  const handleEditClick = useLastCallback(() => {
    onEdit?.(index);
  });

  const content = useMemo(() => {
    switch (displayType) {
      case 'photo':
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
              <div className={styles.duration}>{formatMediaDuration(attachment.quick.duration)}</div>
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
      case 'audio':
        return (
          <>
            <AttachmentAudio
              attachment={attachment}
              className={styles.audio}

              onDecodeError={() => setIsAudioBroken(true)}
            />
            {onDelete && (
              <Icon
                name="delete"
                className={buildClassName(styles.actionItem, styles.deleteFile)}

                onClick={() => onDelete(index)}
              />
            )}
          </>
        );
      default: {
        const canEdit = SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType) && !isMobile;
        return (
          <>
            <File
              className={styles.file}
              name={attachment.filename}
              extension={getFileExtension(attachment.filename, attachment.mimeType)}
              previewAttachment={attachment}
              size={attachment.size}
              previewSize="large"
              onClick={canEdit ? handleEditClick : undefined}
              actionIcon={canEdit ? 'edit' : undefined}
            />
            {onDelete && (
              <Icon
                name="delete"
                className={buildClassName(styles.actionItem, styles.deleteFile)}

                onClick={() => onDelete(index)}
              />
            )}
          </>
        );
      }
    }
  }, [attachment, displayType, index, onDelete, isMobile]);

  const shouldSkipGrouping = displayType === 'file' || displayType === 'audio' || !shouldDisplayGrouped;
  const shouldDisplaySpoiler = Boolean(displayType !== 'file' && displayType !== 'audio'
    && attachment.shouldSendAsSpoiler);
  const shouldRenderOverlay = displayType !== 'file' && displayType !== 'audio';

  const rootClassName = buildClassName(
    className, styles.root, isSingle && styles.single, shouldSkipGrouping && styles.noGrouping,
  );

  return (
    <div className={rootClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {content}
      <MediaSpoiler
        isVisible={shouldDisplaySpoiler}
        thumbDataUri={attachment.previewBlobUrl || attachment.blobUrl}
        width={BLUR_CANVAS_SIZE}
        height={BLUR_CANVAS_SIZE}
      />
      {shouldRenderOverlay && (
        <div className={styles.overlay}>
          {displayType === 'photo' && onEdit && (
            <Icon
              name="edit"
              className={styles.actionItem}
              onClick={handleEditClick}
            />
          )}
          <Icon
            name={attachment.shouldSendAsSpoiler ? 'spoiler-disable' : 'spoiler'}
            className={styles.actionItem}
            onClick={handleSpoilerClick}
          />
          {onDelete && (

            <Icon name="delete" className={styles.actionItem} onClick={() => onDelete(index)} />
          )}
        </div>
      )}
    </div>
  );
};

function getDisplayType(attachment: ApiAttachment, shouldDisplayCompressed?: boolean) {
  if (shouldDisplayCompressed && attachment.quick) {
    if (SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType)) {
      return 'photo';
    }
    if (SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType)) {
      return 'video';
    }
  }
  if (attachment.audio) {
    return 'audio';
  }
  return 'file';
}

export default memo(AttachmentModalItem);
