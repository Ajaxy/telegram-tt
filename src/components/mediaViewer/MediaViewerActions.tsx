import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiMessage, ApiPeer, ApiPhoto,
} from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { MenuItemProps } from '../ui/MenuItem';

import { getMessageMediaFormat, getMessageMediaHash, isUserId } from '../../global/helpers';
import {
  selectAllowedMessageActions,
  selectCurrentMessageList,
  selectIsChatProtected,
  selectIsDownloading,
  selectIsMessageProtected,
} from '../../global/selectors';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useZoomChange from './hooks/useZoomChangeSignal';

import DeleteMessageModal from '../common/DeleteMessageModal';
import DeleteProfilePhotoModal from '../common/DeleteProfilePhotoModal';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';

import './MediaViewerActions.scss';

type StateProps = {
  isDownloading?: boolean;
  isProtected?: boolean;
  isChatProtected?: boolean;
  canDelete?: boolean;
  canUpdate?: boolean;
  messageListType?: MessageListType;
  avatarOwnerId?: string;
};

type OwnProps = {
  mediaData?: string;
  isVideo: boolean;
  message?: ApiMessage;
  canUpdateMedia?: boolean;
  isSingleMedia?: boolean;
  avatarPhoto?: ApiPhoto;
  avatarOwner?: ApiPeer;
  fileName?: string;
  canReport?: boolean;
  selectMedia: (mediaId?: number) => void;
  onReport: NoneToVoidFunction;
  onBeforeDelete: NoneToVoidFunction;
  onCloseMediaViewer: NoneToVoidFunction;
  onForward: NoneToVoidFunction;
};

const MediaViewerActions: FC<OwnProps & StateProps> = ({
  mediaData,
  isVideo,
  message,
  avatarPhoto,
  avatarOwnerId,
  fileName,
  isChatProtected,
  isDownloading,
  isProtected,
  canReport,
  canDelete,
  canUpdate,
  messageListType,
  selectMedia,
  onReport,
  onCloseMediaViewer,
  onBeforeDelete,
  onForward,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);
  const [getZoomChange, setZoomChange] = useZoomChange();
  const { isMobile } = useAppLayout();

  const {
    downloadMessageMedia,
    cancelMessageMediaDownload,
    updateProfilePhoto,
    updateChatPhoto,
  } = getActions();

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    message && getMessageMediaHash(message, 'download'),
    !isDownloading,
    message && getMessageMediaFormat(message, 'download'),
  );

  const handleDownloadClick = useLastCallback(() => {
    if (isDownloading) {
      cancelMessageMediaDownload({ message: message! });
    } else {
      downloadMessageMedia({ message: message! });
    }
  });

  const handleZoomOut = useLastCallback(() => {
    const zoomChange = getZoomChange();
    const change = zoomChange < 0 ? zoomChange : 0;
    setZoomChange(change - 1);
  });

  const handleZoomIn = useLastCallback(() => {
    const zoomChange = getZoomChange();
    const change = zoomChange > 0 ? zoomChange : 0;
    setZoomChange(change + 1);
  });

  const handleUpdate = useLastCallback(() => {
    if (!avatarPhoto || !avatarOwnerId) return;
    if (isUserId(avatarOwnerId)) {
      updateProfilePhoto({ photo: avatarPhoto });
    } else {
      updateChatPhoto({ chatId: avatarOwnerId, photo: avatarPhoto });
    }
    selectMedia(0);
  });

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
        <i className="icon icon-more" />
      </Button>
    );
  }, []);

  function renderDeleteModals() {
    return message
      ? (
        <DeleteMessageModal
          isOpen={isDeleteModalOpen}
          isSchedule={messageListType === 'scheduled'}
          onClose={closeDeleteModal}
          onConfirm={onBeforeDelete}
          message={message}
        />
      )
      : (avatarOwnerId && avatarPhoto) ? (
        <DeleteProfilePhotoModal
          isOpen={isDeleteModalOpen}
          onClose={closeDeleteModal}
          onConfirm={onBeforeDelete}
          profileId={avatarOwnerId}
          photo={avatarPhoto}
        />
      ) : undefined;
  }

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
          <i className="icon icon-download" />
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
        <i className="icon icon-download" />
      </Button>
    );
  }

  if (isMobile) {
    const menuItems: MenuItemProps[] = [];
    if (message?.isForwardingAllowed && !isChatProtected) {
      menuItems.push({
        icon: 'forward',
        onClick: onForward,
        children: lang('Forward'),
      });
    }
    if (!isProtected) {
      if (isVideo) {
        menuItems.push({
          icon: isDownloading ? 'close' : 'download',
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
        icon: 'flag',
        onClick: onReport,
        children: lang('ReportPeer.Report'),
      });
    }

    if (canUpdate) {
      menuItems.push({
        icon: 'copy-media',
        onClick: handleUpdate,
        children: lang('ProfilePhoto.SetMainPhoto'),
      });
    }

    if (canDelete) {
      menuItems.push({
        icon: 'delete',
        onClick: openDeleteModal,
        children: lang('Delete'),
        destructive: true,
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
            icon, onClick, href, download, children, destructive,
          }) => (
            <MenuItem
              key={icon}
              icon={icon}
              href={href}
              download={download}
              onClick={onClick}
              destructive={destructive}
            >
              {children}
            </MenuItem>
          ))}
        </DropdownMenu>
        {isDownloading && <ProgressSpinner progress={downloadProgress} size="s" noCross />}
        {canDelete && renderDeleteModals()}
      </div>
    );
  }

  return (
    <div className="MediaViewerActions">
      {message?.isForwardingAllowed && !isChatProtected && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Forward')}
          onClick={onForward}
        >
          <i className="icon icon-forward" />
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
        <i className="icon icon-zoom-out" />
      </Button>
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('MediaZoomIn')}
        onClick={handleZoomIn}
      >
        <i className="icon icon-zoom-in" />
      </Button>
      {canReport && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang(isVideo ? 'PeerInfo.ReportProfileVideo' : 'PeerInfo.ReportProfilePhoto')}
          onClick={onReport}
        >
          <i className="icon icon-flag" />
        </Button>
      )}
      {canUpdate && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('ProfilePhoto.SetMainPhoto')}
          onClick={handleUpdate}
        >
          <i className="icon icon-copy-media" />
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
          <i className="icon icon-delete" />
        </Button>
      )}
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('Close')}
        onClick={onCloseMediaViewer}
      >
        <i className="icon icon-close" />
      </Button>
      {canDelete && renderDeleteModals()}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    message, canUpdateMedia, avatarPhoto, avatarOwner,
  }): StateProps => {
    const currentMessageList = selectCurrentMessageList(global);
    const { threadId } = selectCurrentMessageList(global) || {};
    const isDownloading = message ? selectIsDownloading(global, message) : false;
    const isProtected = selectIsMessageProtected(global, message);
    const isChatProtected = message && selectIsChatProtected(global, message?.chatId);
    const { canDelete: canDeleteMessage } = (threadId
      && message && selectAllowedMessageActions(global, message, threadId)) || {};
    const isCurrentAvatar = avatarPhoto && (avatarPhoto.id === avatarOwner?.avatarHash);
    const canDeleteAvatar = canUpdateMedia && !!avatarPhoto;
    const canDelete = canDeleteMessage || canDeleteAvatar;
    const canUpdate = canUpdateMedia && !!avatarPhoto && !isCurrentAvatar;
    const messageListType = currentMessageList?.type;

    return {
      isDownloading,
      isProtected,
      isChatProtected,
      canDelete,
      canUpdate,
      messageListType,
      avatarOwnerId: avatarOwner?.id,
    };
  },
)(MediaViewerActions));
