import React, {
  FC, useCallback, useEffect, useState, memo, useRef,
} from '../../lib/teact/teact';

import { ApiMediaFormat, ApiMessage } from '../../api/types';

import { getDocumentExtension, getDocumentHasPreview } from './helpers/documentInfo';
import {
  getMediaTransferState,
  getMessageMediaHash,
  getMessageMediaThumbDataUri,
  isMessageDocumentVideo,
} from '../../modules/helpers';
import { ObserveFn, useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMediaWithDownloadProgress from '../../hooks/useMediaWithDownloadProgress';
import useMedia from '../../hooks/useMedia';
import download from '../../util/download';

import File from './File';

type OwnProps = {
  message: ApiMessage;
  observeIntersection?: ObserveFn;
  smaller?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  uploadProgress?: number;
  withDate?: boolean;
  datetime?: number;
  className?: string;
  sender?: string;
  onCancelUpload?: () => void;
  onMediaClick?: () => void;
  onDateClick?: (messageId: number, chatId: number) => void;
};

const Document: FC<OwnProps> = ({
  message,
  observeIntersection,
  smaller,
  uploadProgress,
  withDate,
  datetime,
  className,
  sender,
  isSelected,
  isSelectable,
  onCancelUpload,
  onMediaClick,
  onDateClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const document = message.content.document!;
  const extension = getDocumentExtension(document) || '';
  const { fileName, size, timestamp } = document;
  const withMediaViewer = onMediaClick && Boolean(document.mediaType);

  const isIntersecting = useIsIntersecting(ref, observeIntersection);

  const [isDownloadAllowed, setIsDownloadAllowed] = useState(false);
  const {
    mediaData, downloadProgress,
  } = useMediaWithDownloadProgress<ApiMediaFormat.BlobUrl>(
    getMessageMediaHash(message, 'download'), !isDownloadAllowed, undefined, undefined, undefined, true,
  );
  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(message, uploadProgress || downloadProgress, isDownloadAllowed);

  const hasPreview = getDocumentHasPreview(document);
  const thumbDataUri = hasPreview ? getMessageMediaThumbDataUri(message) : undefined;
  const localBlobUrl = hasPreview ? document.previewBlobUrl : undefined;
  const previewData = useMedia(getMessageMediaHash(message, 'pictogram'), !isIntersecting);

  const handleClick = useCallback(() => {
    if (withMediaViewer) {
      onMediaClick!();
    } else if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload();
      }
    } else {
      setIsDownloadAllowed((isAllowed) => !isAllowed);
    }
  }, [withMediaViewer, isUploading, onCancelUpload, onMediaClick]);

  const handleDateClick = useCallback(() => {
    onDateClick!(message.id, message.chatId);
  }, [onDateClick, message.id, message.chatId]);

  useEffect(() => {
    if (isDownloadAllowed && mediaData) {
      download(mediaData, fileName);
      setIsDownloadAllowed(false);
    }
  }, [fileName, mediaData, isDownloadAllowed]);

  return (
    <File
      ref={ref}
      name={fileName}
      extension={extension}
      size={size}
      timestamp={withDate ? datetime || timestamp : undefined}
      thumbnailDataUri={thumbDataUri}
      previewData={localBlobUrl || previewData}
      smaller={smaller}
      isTransferring={isTransferring}
      isUploading={isUploading}
      transferProgress={transferProgress}
      className={className}
      sender={sender}
      isSelectable={isSelectable}
      isSelected={isSelected}
      actionIcon={withMediaViewer ? (isMessageDocumentVideo(message) ? 'icon-play' : 'icon-eye') : 'icon-download'}
      onClick={handleClick}
      onDateClick={onDateClick ? handleDateClick : undefined}
    />
  );
};

export default memo(Document);
