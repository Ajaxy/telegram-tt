import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';

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
  zoomLevelChange: number;
  message?: ApiMessage;
  fileName?: string;
  isAvatar?: boolean;
  canReport?: boolean;
  onReport: NoneToVoidFunction;
  onCloseMediaViewer: NoneToVoidFunction;
  onForward: NoneToVoidFunction;
  setZoomLevelChange: (change: number) => void;
};

const MediaViewerActions: FC<OwnProps & StateProps> = ({
  mediaData,
  isVideo,
  message,
  fileName,
  isAvatar,
  isDownloading,
  isProtected,
  canReport,
  onReport,
  onCloseMediaViewer,
  zoomLevelChange,
  setZoomLevelChange,
  onForward,
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

  const handleZoomOut = useCallback(() => {
    const change = zoomLevelChange < 0 ? zoomLevelChange : 0;
    setZoomLevelChange(change - 1);
  }, [setZoomLevelChange, zoomLevelChange]);

  const handleZoomIn = useCallback(() => {
    const change = zoomLevelChange > 0 ? zoomLevelChange : 0;
    setZoomLevelChange(change + 1);
  }, [setZoomLevelChange, zoomLevelChange]);

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
          {canReport && (
            <MenuItem
              icon="flag"
              onClick={onReport}
            >
              {lang('ReportPeer.Report')}
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
        ariaLabel={lang('MediaZoomOut')}
        onClick={handleZoomOut}
      >
        <i className="icon-zoom-out" />
      </Button>
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('MediaZoomIn')}
        onClick={handleZoomIn}
      >
        <i className="icon-zoom-in" />
      </Button>
      {canReport && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang(isVideo ? 'PeerInfo.ReportProfileVideo' : 'PeerInfo.ReportProfilePhoto')}
          onClick={onReport}
        >
          <i className="icon-flag" />
        </Button>
      )}
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
