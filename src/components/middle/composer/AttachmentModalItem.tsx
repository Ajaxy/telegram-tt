import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiAttachment } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { MediaEditDocument } from '../../../types/mediaEditor';

import { SUPPORTED_PHOTO_CONTENT_TYPES, SUPPORTED_VIDEO_CONTENT_TYPES } from '../../../config';
import { selectAnimationLevel } from '../../../global/selectors/sharedState';
import { selectCanAnimateInterface } from '../../../global/selectors/ui';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dates/duration';
import { getFileExtension } from '../../common/helpers/documentInfo';
import { REM } from '../../common/helpers/mediaDimensions';
import { prepareMediaEditorGhost } from '../../mediaViewer/helpers/ghostAnimation';
import { hasPictureEdits } from '../../ui/mediaEditor/editDocument';
import { getCanRenderAdjustments } from '../../ui/mediaEditor/render/adjustments/adjustmentsProgram';
import { hasColorAdjustments } from '../../ui/mediaEditor/render/adjustments/values';
import loopVideoInTrim from '../../ui/mediaEditor/video/loopVideoInTrim';

import useAppLayout from '../../../hooks/useAppLayout';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AttachmentAudio from '../../common/AttachmentAudio';
import File from '../../common/File';
import Icon from '../../common/icons/Icon';
import MediaSpoiler from '../../common/MediaSpoiler';
import EditedVideoPreview from '../../ui/mediaEditor/EditedVideoPreview';

import styles from './AttachmentModalItem.module.scss';

type OwnProps = {
  attachment: ApiAttachment;
  className?: string;
  shouldDisplayCompressed?: boolean;
  shouldDisplayGrouped?: boolean;
  isSingle?: boolean;
  isEditing?: boolean;
  index: number;
  observeIntersection?: ObserveFn;
  onDelete?: (index: number) => void;
  onToggleSpoiler?: (index: number) => void;
  onEdit?: (index: number, hasGhost?: boolean, videoTime?: number) => void;
};

const BLUR_CANVAS_SIZE = 15 * REM;
const EDITED_PREVIEW_MAX_WIDTH = 26.25 * REM;

const AttachmentModalItem = ({
  attachment,
  className,
  isSingle,
  isEditing,
  shouldDisplayCompressed,
  shouldDisplayGrouped,
  index,
  observeIntersection,
  onDelete,
  onToggleSpoiler,
  onEdit,
}: OwnProps) => {
  const lang = useLang();
  const { isMobile } = useAppLayout();
  const rootRef = useRef<HTMLDivElement>();
  const videoRef = useRef<HTMLVideoElement>();
  const [isAudioBroken, setIsAudioBroken] = useState(false);
  const displayType = isAudioBroken ? 'file' : getDisplayType(attachment, shouldDisplayCompressed);
  const editDocument = attachment.editState?.document;
  const editSourceSize = attachment.videoProcessing?.sourceSize;
  const hasEditedPicture = Boolean(editDocument && editSourceSize && hasPictureEdits(editDocument, editSourceSize));
  const staticVideoPreviewUrl = attachment.videoCover?.blobUrl
    ?? (hasEditedPicture ? attachment.previewBlobUrl : undefined);
  const canPlayEditedPicture = displayType === 'video' && hasEditedPicture && !attachment.videoCover
    && !attachment.shouldSendAsSpoiler && (!hasColorAdjustments(editDocument!) || getCanRenderAdjustments());
  const isSourceVideoPreview = displayType === 'video' && !staticVideoPreviewUrl && !canPlayEditedPicture;
  const trimStart = editDocument?.trim?.start;
  const trimEnd = editDocument?.trim?.end;
  const isIntersecting = useIsIntersecting(rootRef, observeIntersection);
  const wasIntersectedRef = useRef(isIntersecting);
  if (isIntersecting) wasIntersectedRef.current = true;
  const [readyEditDocument, setReadyEditDocument] = useState<MediaEditDocument>();
  const isEditedPreviewShown = canPlayEditedPicture && readyEditDocument === editDocument;
  const editedPreviewTimeRef = useRef<number>();
  const editedPreviewMaxSide = editDocument
    ? EDITED_PREVIEW_MAX_WIDTH * Math.max(1, editDocument.crop.cropperHeight / editDocument.crop.cropperWidth)
    : EDITED_PREVIEW_MAX_WIDTH;

  useEffect(() => {
    if (!canPlayEditedPicture) setReadyEditDocument(undefined);
  }, [canPlayEditedPicture]);

  useEffect(() => {
    const video = videoRef.current;
    if (!isSourceVideoPreview || !video || trimStart === undefined || trimEnd === undefined) return undefined;

    return loopVideoInTrim(video, trimStart, trimEnd);
  }, [isSourceVideoPreview, trimStart, trimEnd]);

  const handleEditedPreviewTimeUpdate = useLastCallback((time: number) => {
    editedPreviewTimeRef.current = time;
  });

  const handleSpoilerClick = useLastCallback(() => {
    onToggleSpoiler?.(index);
  });

  const handleEditClick = useLastCallback(() => {
    if (!onEdit) return;

    const global = getGlobal();
    const canAnimate = selectAnimationLevel(global) > 0 && selectCanAnimateInterface(global);
    const preview = rootRef.current!.querySelector<HTMLImageElement | HTMLVideoElement | HTMLCanvasElement>(
      `.${styles.preview}`,
    );
    if (!preview || !canAnimate || attachment.shouldSendAsSpoiler || !prepareMediaEditorGhost(preview)) {
      onEdit(index, undefined, trimStart);
      return;
    }

    const videoTime = preview instanceof HTMLVideoElement ? preview.currentTime
      : preview instanceof HTMLCanvasElement ? editedPreviewTimeRef.current : trimStart;
    onEdit(index, true, videoTime);
  });

  const content = useMemo(() => {
    switch (displayType) {
      case 'photo':
        return (
          <>
            {attachment.shouldSendAsGif && <div className={styles.duration}>{lang('AttachGif')}</div>}
            <img
              className={styles.preview}
              src={attachment.blobUrl}
              alt=""
              draggable={false}
            />
          </>
        );
      case 'video': {
        return (
          <>
            {attachment.shouldSendAsGif ? (
              <div className={styles.duration}>{lang('AttachGif')}</div>
            ) : Boolean(attachment.quick?.duration) && (
              <div className={styles.duration}>{formatMediaDuration(attachment.quick.duration)}</div>
            )}
            {canPlayEditedPicture && wasIntersectedRef.current && (
              <EditedVideoPreview
                className={isEditedPreviewShown ? styles.preview : styles.hidden}
                blobUrl={attachment.blobUrl}
                mimeType={attachment.mimeType}
                editDocument={editDocument!}
                maxSide={editedPreviewMaxSide}
                canPlay={isIntersecting}
                onReady={setReadyEditDocument}
                onTimeUpdate={handleEditedPreviewTimeUpdate}
              />
            )}
            {staticVideoPreviewUrl ? !isEditedPreviewShown && (
              <img
                className={styles.preview}
                src={staticVideoPreviewUrl}
                alt=""
                draggable={false}
              />
            ) : !canPlayEditedPicture && (
              <video
                ref={videoRef}
                className={styles.preview}
                src={trimStart ? `${attachment.blobUrl}#t=${trimStart}` : attachment.blobUrl}
                autoPlay
                muted
                loop={trimEnd === undefined}
                disablePictureInPicture
              />
            )}
          </>
        );
      }
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
        const canEdit = Boolean(onEdit) && (SUPPORTED_PHOTO_CONTENT_TYPES.has(attachment.mimeType)
          || SUPPORTED_VIDEO_CONTENT_TYPES.has(attachment.mimeType)) && !isMobile;
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
  }, [
    attachment, displayType, index, onDelete, onEdit, isMobile, lang, staticVideoPreviewUrl, trimStart, trimEnd,
    canPlayEditedPicture, isEditedPreviewShown, editDocument, isIntersecting, editedPreviewMaxSide,
  ]);

  const shouldSkipGrouping = displayType === 'file' || displayType === 'audio' || !shouldDisplayGrouped;
  const shouldDisplaySpoiler = Boolean(displayType !== 'file' && displayType !== 'audio'
    && attachment.shouldSendAsSpoiler);
  const shouldRenderOverlay = displayType !== 'file' && displayType !== 'audio';

  const rootClassName = buildClassName(
    className,
    styles.root,
    isSingle && styles.single,
    shouldSkipGrouping && styles.noGrouping,
    isEditing && styles.editing,
  );

  return (
    <div ref={rootRef} className={rootClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      {content}
      <MediaSpoiler
        isVisible={shouldDisplaySpoiler}
        thumbDataUri={attachment.previewBlobUrl || attachment.blobUrl}
        width={BLUR_CANVAS_SIZE}
        height={BLUR_CANVAS_SIZE}
      />
      {shouldRenderOverlay && (
        <div className={styles.overlay}>
          {(displayType === 'photo' || displayType === 'video') && onEdit && (
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
