import React, {
  FC, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import download from '../../util/download';
import { getMessageMediaHash } from '../../modules/helpers';
import useMediaWithDownloadProgress from '../../hooks/useMediaWithDownloadProgress';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';

import './MediaViewerActions.scss';

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

const MediaViewerActions: FC<OwnProps> = ({
  mediaData,
  isVideo,
  isZoomed,
  message,
  fileName,
  isAvatar,
  onCloseMediaViewer,
  onForward,
  onZoomToggle,
}) => {
  const [isVideoDownloadAllowed, setIsVideoDownloadAllowed] = useState(false);
  const videoMediaHash = isVideo && message ? getMessageMediaHash(message, 'download') : undefined;
  const {
    mediaData: videoBlobUrl, downloadProgress,
  } = useMediaWithDownloadProgress(videoMediaHash, !isVideoDownloadAllowed);

  // Download with browser when fully loaded
  useEffect(() => {
    if (isVideoDownloadAllowed && videoBlobUrl) {
      download(videoBlobUrl, fileName!);
      setIsVideoDownloadAllowed(false);
    }
  }, [fileName, videoBlobUrl, isVideoDownloadAllowed]);

  // Cancel download on slide change
  useEffect(() => {
    setIsVideoDownloadAllowed(false);
  }, [videoMediaHash]);

  const handleVideoDownloadClick = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    setIsVideoDownloadAllowed((isAllowed) => !isAllowed);
  }, []);

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

  if (IS_MOBILE_SCREEN) {
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
              icon={isVideoDownloadAllowed ? 'close' : 'download'}
              onClick={handleVideoDownloadClick}
            >
              {isVideoDownloadAllowed ? `${Math.round(downloadProgress * 100)}% Downloading...` : 'Download'}
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
        {isVideoDownloadAllowed && <ProgressSpinner progress={downloadProgress} size="s" noCross />}
      </div>
    );
  }

  return (
    <div className="MediaViewerActions">
      {!isAvatar && (
        <>
          <Button
            round
            size="smaller"
            color="translucent-white"
            ariaLabel={lang('Forward')}
            onClick={onForward}
          >
            <i className="icon-forward" />
          </Button>
        </>
      )}
      {isVideo ? (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('AccActionDownload')}
          onClick={handleVideoDownloadClick}
        >
          {isVideoDownloadAllowed ? (
            <ProgressSpinner progress={downloadProgress} size="s" onClick={handleVideoDownloadClick} />
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
      )}
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

export default MediaViewerActions;
