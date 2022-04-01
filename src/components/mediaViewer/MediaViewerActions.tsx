import React, {
  FC,
  memo,
  useCallback,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiMessage } from '../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { getMessageMediaHash } from '../../global/helpers';
import useLang from '../../hooks/useLang';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import { selectIsDownloading, selectIsMessageProtected } from '../../global/selectors';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';

import './MediaViewerActions.scss';

type StateProps = {
  isDownloading: boolean;
  isProtected?: boolean;
};

type OwnProps = {
  mediaData?: string;
  isVideo: boolean;
  isZoomed: boolean;
  message?: ApiMessage;
  fileName?: string;
  isAvatar?: boolean;
  onCloseMediaViewer: NoneToVoidFunction;
  onForward: NoneToVoidFunction;
  onZoomToggle: NoneToVoidFunction;
};

const MediaViewerActions: FC<OwnProps & StateProps> = ({
  mediaData,
  isVideo,
  isZoomed,
  message,
  fileName,
  isAvatar,
  isDownloading,
  isProtected,
  onCloseMediaViewer,
  onForward,
  onZoomToggle,
}) => {
  const {
    downloadMessageMedia,
    cancelMessageMediaDownload,
  } = getActions();

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    message && getMessageMediaHash(message, 'download'),
    !isDownloading,
  );

  const handleDownloadClick = useCallback(() => {
    if (isDownloading) {
      cancelMessageMediaDownload({ message: message! });
    } else {
      downloadMessageMedia({ message: message! });
    }
  }, [cancelMessageMediaDownload, downloadMessageMedia, isDownloading, message]);

  const lang = useLang();

  const MenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen }) => (
      <Button
        round
        size="smaller"
        color="translucent"
        className={isOpen ? 'active' : undefined}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  function renderDownloadButton() {
    if (isProtected) {
      return undefined;
    }

    return isVideo ? (
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('AccActionDownload')}
        onClick={handleDownloadClick}
      >
        {isDownloading ? (
          <ProgressSpinner progress={downloadProgress} size="s" onClick={handleDownloadClick} />
        ) : (
          <i className="icon-download" />
        )}
      </Button>
    ) : (
      <Button
        href={mediaData}
        download={fileName}
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('AccActionDownload')}
      >
        <i className="icon-download" />
      </Button>
    );
  }

  if (IS_SINGLE_COLUMN_LAYOUT) {
    if (isProtected) {
      return undefined;
    }

    return (
      <div className="MediaViewerActions-mobile">
        <DropdownMenu
          trigger={MenuButton}
          positionX="right"
        >
          {!isAvatar && (
            <MenuItem
              icon="forward"
              onClick={onForward}
            >
              {lang('Forward')}
            </MenuItem>
          )}
          {isVideo ? (
            <MenuItem
              icon={isDownloading ? 'close' : 'download'}
              onClick={handleDownloadClick}
            >
              {isDownloading ? `${Math.round(downloadProgress * 100)}% Downloading...` : 'Download'}
            </MenuItem>
          ) : (
            <MenuItem
              icon="download"
              href={mediaData}
              download={fileName}
            >
              {lang('AccActionDownload')}
            </MenuItem>
          )}
        </DropdownMenu>
        {isDownloading && <ProgressSpinner progress={downloadProgress} size="s" noCross />}
      </div>
    );
  }

  return (
    <div className="MediaViewerActions">
      {!isAvatar && !isProtected && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Forward')}
          onClick={onForward}
        >
          <i className="icon-forward" />
        </Button>
      )}
      {renderDownloadButton()}
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={isZoomed ? 'Zoom Out' : 'Zoom In'}
        onClick={onZoomToggle}
      >
        <i className={isZoomed ? 'icon-zoom-out' : 'icon-zoom-in'} />
      </Button>
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('Close')}
        onClick={onCloseMediaViewer}
      >
        <i className="icon-close" />
      </Button>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const isDownloading = message ? selectIsDownloading(global, message) : false;
    const isProtected = selectIsMessageProtected(global, message);

    return {
      isDownloading,
      isProtected,
    };
  },
)(MediaViewerActions));
