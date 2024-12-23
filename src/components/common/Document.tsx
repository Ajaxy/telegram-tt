import React, {
  memo, useEffect, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiDocument, ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  getDocumentMediaHash,
  getMediaFormat,
  getMediaThumbUri,
  getMediaTransferState,
  isDocumentVideo,
} from '../../global/helpers';
import { getDocumentExtension, getDocumentHasPreview } from './helpers/documentInfo';

import useFlag from '../../hooks/useFlag';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useOldLang from '../../hooks/useOldLang';

import Checkbox from '../ui/Checkbox';
import ConfirmDialog from '../ui/ConfirmDialog';
import File from './File';

type OwnProps = {
  document: ApiDocument;
  observeIntersection?: ObserveFn;
  smaller?: boolean;
  isSelected?: boolean;
  isSelectable?: boolean;
  canAutoLoad?: boolean;
  uploadProgress?: number;
  withDate?: boolean;
  datetime?: number;
  className?: string;
  sender?: string;
  autoLoadFileMaxSizeMb?: number;
  isDownloading?: boolean;
  shouldWarnAboutSvg?: boolean;
  onCancelUpload?: () => void;
  onMediaClick?: () => void;
} & ({
  message: ApiMessage;
  onDateClick: (arg: ApiMessage) => void;
} | {
  message?: ApiMessage;
  onDateClick?: never;
});

const BYTES_PER_MB = 1024 * 1024;
const SVG_EXTENSIONS = new Set(['svg', 'svgz']);

const Document = ({
  document,
  observeIntersection,
  smaller,
  canAutoLoad,
  autoLoadFileMaxSizeMb,
  uploadProgress,
  withDate,
  datetime,
  className,
  sender,
  isSelected,
  isSelectable,
  shouldWarnAboutSvg,
  isDownloading,
  message,
  onCancelUpload,
  onMediaClick,
  onDateClick,
}: OwnProps) => {
  const { cancelMediaDownload, downloadMedia, setSettingOption } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const lang = useOldLang();
  const [isSvgDialogOpen, openSvgDialog, closeSvgDialog] = useFlag();
  const [shouldNotWarnAboutSvg, setShouldNotWarnAboutSvg] = useState(false);

  const { fileName, size, timestamp } = document;
  const extension = getDocumentExtension(document) || '';

  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const [wasIntersected, markIntersected] = useFlag();
  useEffect(() => {
    if (isIntersecting) {
      markIntersected();
    }
  }, [isIntersecting, markIntersected]);

  // Auto-loading does not use global download manager because requires additional click to save files locally
  const [isLoadAllowed, setIsLoadAllowed] = useState(
    canAutoLoad && (!autoLoadFileMaxSizeMb || size <= autoLoadFileMaxSizeMb * BYTES_PER_MB),
  );

  const shouldDownload = Boolean(isDownloading || (isLoadAllowed && wasIntersected));

  const documentHash = getDocumentMediaHash(document, 'download');
  const { loadProgress: downloadProgress, mediaData } = useMediaWithLoadProgress(
    documentHash, !shouldDownload, getMediaFormat(document, 'download'), undefined, true,
  );
  const isLoaded = Boolean(mediaData);

  const {
    isUploading, isTransferring, transferProgress,
  } = getMediaTransferState(
    uploadProgress || downloadProgress,
    shouldDownload && !isLoaded,
    uploadProgress !== undefined,
  );

  const hasPreview = getDocumentHasPreview(document);
  const thumbDataUri = hasPreview ? getMediaThumbUri(document) : undefined;
  const localBlobUrl = hasPreview ? document.previewBlobUrl : undefined;
  const previewData = useMedia(getDocumentMediaHash(document, 'pictogram'), !isIntersecting);

  const withMediaViewer = onMediaClick && document.innerMediaType;

  const handleDownload = useLastCallback(() => {
    downloadMedia({ media: document, originMessage: message });
  });

  const handleClick = useLastCallback(() => {
    if (isUploading) {
      if (onCancelUpload) {
        onCancelUpload();
      }
      return;
    }

    if (isDownloading) {
      cancelMediaDownload({ media: document });
      return;
    }

    if (isTransferring) {
      setIsLoadAllowed(false);
      return;
    }

    if (withMediaViewer) {
      onMediaClick!();
      return;
    }

    if (SVG_EXTENSIONS.has(extension) && shouldWarnAboutSvg) {
      openSvgDialog();
      return;
    }

    handleDownload();
  });

  const handleSvgConfirm = useLastCallback(() => {
    setSettingOption({ shouldWarnAboutSvg: !shouldNotWarnAboutSvg });
    closeSvgDialog();
    handleDownload();
  });

  const handleDateClick = useLastCallback(() => {
    onDateClick?.(message);
  });

  return (
    <>
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
        actionIcon={withMediaViewer ? (isDocumentVideo(document) ? 'play' : 'eye') : 'download'}
        onClick={handleClick}
        onDateClick={onDateClick ? handleDateClick : undefined}
      />
      <ConfirmDialog
        isOpen={isSvgDialogOpen}
        onClose={closeSvgDialog}
        confirmHandler={handleSvgConfirm}
      >
        {lang('lng_launch_svg_warning')}
        <Checkbox
          className="dialog-checkbox"
          checked={shouldNotWarnAboutSvg}
          label={lang('lng_launch_exe_dont_ask')}
          onCheck={setShouldNotWarnAboutSvg}
        />
      </ConfirmDialog>
    </>
  );
};

export default memo(Document);
