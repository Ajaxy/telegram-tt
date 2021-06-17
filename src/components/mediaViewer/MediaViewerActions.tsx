import React, { FC, useMemo } from '../../lib/teact/teact';

import { ApiMessage } from '../../api/types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import { getMessageMediaHash } from '../../modules/helpers';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';

import './MediaViewerActions.scss';
import useMediaDownload from '../../hooks/useMediaDownload';

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
  const {
    isDownloadStarted,
    downloadProgress,
    handleDownloadClick,
  } = useMediaDownload(message && isVideo ? getMessageMediaHash(message, 'download') : undefined);

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
              icon={isDownloadStarted ? 'close' : 'download'}
              onClick={handleDownloadClick}
            >
              {isDownloadStarted ? `${Math.round(downloadProgress * 100)}% Downloading...` : 'Download'}
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
        {isDownloadStarted && <ProgressSpinner progress={downloadProgress} size="s" noCross />}
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
          onClick={handleDownloadClick}
        >
          {isDownloadStarted ? (
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
