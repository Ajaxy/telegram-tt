import type { FC } from '../../lib/teact/teact';
import React, {
  memo,
  useCallback,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { MessageListType } from '../../global/types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { getMessageMediaFormat, getMessageMediaHash } from '../../global/helpers';
import useLang from '../../hooks/useLang';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useFlag from '../../hooks/useFlag';
import {
  selectIsDownloading, selectIsMessageProtected, selectAllowedMessageActions, selectCurrentMessageList,
} from '../../global/selectors';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import type { MenuItemProps } from '../ui/MenuItem';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';
import DeleteMessageModal from '../common/DeleteMessageModal';

import './MediaViewerActions.scss';

type StateProps = {
  isDownloading: boolean;
  isProtected?: boolean;
  canDelete?: boolean;
  messageListType?: MessageListType;
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
  canDelete,
  onForward,
  messageListType,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);

  const {
    downloadMessageMedia,
    cancelMessageMediaDownload,
  } = getActions();

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    message && getMessageMediaHash(message, 'download'),
    !isDownloading,
    message && getMessageMediaFormat(message, 'download'),
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
    const menuItems: MenuItemProps[] = [];
    if (!isAvatar && !isProtected) {
      menuItems.push({
        icon: 'forward',
        onClick: onForward,
        children: lang('Forward'),
      });
    }
    if (!isProtected) {
      if (isVideo) {
        menuItems.push({
          icon: isDownloading ? 'cancel' : 'download',
          onClick: handleDownloadClick,
          children: isDownloading ? `${Math.round(downloadProgress * 100)}% Downloading...` : 'Download',
        });
      } else {
        menuItems.push({
          icon: 'download',
          href: mediaData,
          download: fileName,
          children: lang('AccActionDownload'),
        });
      }
    }

    if (canReport) {
      menuItems.push({
        icon: 'report',
        onClick: onReport,
        children: lang('ReportPeer.Report'),
      });
    }

    if (canDelete) {
      menuItems.push({
        icon: 'delete',
        onClick: openDeleteModal,
        children: lang('Delete'),
      });
    }

    if (menuItems.length === 0) {
      return undefined;
    }

    return (
      <div className="MediaViewerActions-mobile">
        <DropdownMenu
          trigger={MenuButton}
          positionX="right"
        >
          {menuItems.map(({
            icon, onClick, href, download, children,
          }) => (
            <MenuItem
              key={icon}
              icon={icon}
              href={href}
              download={download}
              onClick={onClick}
            >
              {children}
            </MenuItem>
          ))}
        </DropdownMenu>
        {isDownloading && <ProgressSpinner progress={downloadProgress} size="s" noCross />}
        {message && canDelete && (
          <DeleteMessageModal
            isOpen={isDeleteModalOpen}
            isSchedule={messageListType === 'scheduled'}
            onClose={closeDeleteModal}
            message={message}
          />
        )}
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
      {canDelete && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Delete')}
          onClick={openDeleteModal}
        >
          <i className="icon-delete" />
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
      {message && canDelete && (
        <DeleteMessageModal
          isOpen={isDeleteModalOpen}
          isSchedule={messageListType === 'scheduled'}
          onClose={closeDeleteModal}
          message={message}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const currentMessageList = selectCurrentMessageList(global);
    const { threadId } = selectCurrentMessageList(global) || {};
    const isDownloading = message ? selectIsDownloading(global, message) : false;
    const isProtected = selectIsMessageProtected(global, message);
    const { canDelete } = (threadId && message && selectAllowedMessageActions(global, message, threadId)) || {};
    const messageListType = currentMessageList?.type;

    return {
      isDownloading,
      isProtected,
      canDelete,
      messageListType,
    };
  },
)(MediaViewerActions));
