import React, {
  memo,
  useCallback,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type {
  ApiMessage, ApiPhoto, ApiChat, ApiUser,
} from '../../api/types';
import type { MessageListType } from '../../global/types';
import type { MenuItemProps } from '../ui/MenuItem';

import {
  selectIsDownloading,
  selectIsMessageProtected,
  selectAllowedMessageActions,
  selectCurrentMessageList,
  selectIsChatProtected,
} from '../../global/selectors';
import { getMessageMediaFormat, getMessageMediaHash, isUserId } from '../../global/helpers';

import useLang from '../../hooks/useLang';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useFlag from '../../hooks/useFlag';
import useAppLayout from '../../hooks/useAppLayout';

import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';
import DeleteMessageModal from '../common/DeleteMessageModal';
import DeleteProfilePhotoModal from '../common/DeleteProfilePhotoModal';

import './MediaViewerActions.scss';

type StateProps = {
  isDownloading: boolean;
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
  zoomLevelChange: number;
  message?: ApiMessage;
  canUpdateMedia?: boolean;
  isSingleMedia?: boolean;
  avatarPhoto?: ApiPhoto;
  avatarOwner?: ApiChat | ApiUser;
  fileName?: string;
  canReport?: boolean;
  selectMedia: (mediaId?: number) => void;
  onReport: NoneToVoidFunction;
  onBeforeDelete: NoneToVoidFunction;
  onCloseMediaViewer: NoneToVoidFunction;
  onForward: NoneToVoidFunction;
  setZoomLevelChange: (change: number) => void;
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
  zoomLevelChange,
  canDelete,
  canUpdate,
  messageListType,
  selectMedia,
  onReport,
  onCloseMediaViewer,
  onBeforeDelete,
  onForward,
  setZoomLevelChange,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);
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

  const handleUpdate = useCallback(() => {
    if (!avatarPhoto || !avatarOwnerId) return;
    if (isUserId(avatarOwnerId)) {
      updateProfilePhoto({ photo: avatarPhoto });
    } else {
      updateChatPhoto({ chatId: avatarOwnerId, photo: avatarPhoto });
    }
    selectMedia(0);
  }, [avatarPhoto, avatarOwnerId, selectMedia, updateProfilePhoto, updateChatPhoto]);

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

  if (isMobile) {
    const menuItems: MenuItemProps[] = [];
    if (!message?.isForwardingAllowed && !isChatProtected) {
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
      {canUpdate && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('ProfilePhoto.SetMainPhoto')}
          onClick={handleUpdate}
        >
          <i className="icon-copy-media" />
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
