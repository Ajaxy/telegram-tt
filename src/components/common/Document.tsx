import {
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
import { isIpRevealingMedia } from '../../util/media/ipRevealingMedia';
import { getDocumentExtension, getDocumentHasPreview } from './helpers/documentInfo';
import { preloadDocumentMedia } from './helpers/preloadDocumentMedia';

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
  datetime?: number;
  className?: string;
  sender?: string;
  autoLoadFileMaxSizeMb?: number;
  isDownloading?: boolean;
  shouldWarnAboutFiles?: boolean;
  id?: string;
  onCancelUpload?: NoneToVoidFunction;
} & ({
  message: ApiMessage;
  onDateClick: (arg: ApiMessage) => void;
  onMediaClick?: (messageId: number) => void;
} | {
  message?: ApiMessage;
  onDateClick?: never;
  onMediaClick?: NoneToVoidFunction;
});

const BYTES_PER_MB = 1024 * 1024;

const Document = ({
  document,
  observeIntersection,
  smaller,
  canAutoLoad,
  autoLoadFileMaxSizeMb,
  uploadProgress,
  datetime,
  className,
  sender,
  isSelected,
  isSelectable,
  shouldWarnAboutFiles,
  isDownloading,
  message,
  id,
  onCancelUpload,
  onMediaClick,
  onDateClick,
}: OwnProps) => {
  const { cancelMediaDownload, downloadMedia, setSharedSettingOption } = getActions();

  const ref = useRef<HTMLDivElement>();

  const lang = useOldLang();
  const [isFileIpDialogOpen, openFileIpDialog, closeFileIpDialog] = useFlag();
  const [shouldNotWarnAboutFiles, setShouldNotWarnAboutFiles] = useState(false);

  const { fileName, size, mimeType } = document;
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

  const shouldForceDownload = document.innerMediaType === 'photo' && document.mediaSize
    && !document.mediaSize.fromDocumentAttribute && !document.mediaSize.fromPreload;

  const withMediaViewer = onMediaClick && document.innerMediaType && !shouldForceDownload;

  useEffect(() => {
    const fileEl = ref.current;
    if (!withMediaViewer || !fileEl || !message) return;

    const onHover = () => {
      preloadDocumentMedia(message);
    };

    fileEl.addEventListener('mouseenter', onHover);

    return () => {
      fileEl.removeEventListener('mouseenter', onHover);
    };
  }, [withMediaViewer, message]);

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
      if (message) {
        onMediaClick?.(message.id);
      } else if (onMediaClick) {
        (onMediaClick as NoneToVoidFunction)();
      }
      return;
    }

    if (isIpRevealingMedia({ mimeType, extension }) && shouldWarnAboutFiles) {
      openFileIpDialog();
      return;
    }

    handleDownload();
  });

  const handleFileIpConfirm = useLastCallback(() => {
    setSharedSettingOption({ shouldWarnAboutFiles: !shouldNotWarnAboutFiles });
    closeFileIpDialog();
    handleDownload();
  });

  const handleDateClick = useLastCallback(() => {
    onDateClick?.(message);
  });

  return (
    <>
      <File
        ref={ref}
        id={id}
        name={fileName}
        extension={extension}
        size={size}
        timestamp={datetime}
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
        isOpen={isFileIpDialogOpen}
        onClose={closeFileIpDialog}
        confirmHandler={handleFileIpConfirm}
      >
        {lang('lng_launch_svg_warning')}
        <Checkbox
          className="dialog-checkbox"
          checked={shouldNotWarnAboutFiles}
          label={lang('lng_launch_exe_dont_ask')}
          onCheck={setShouldNotWarnAboutFiles}
        />
      </ConfirmDialog>
    </>
  );
};

export default memo(Document);
