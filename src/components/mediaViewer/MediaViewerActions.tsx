import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat } from '../../api/types';
import type { ActiveDownloads, MediaViewerOrigin, MessageListType } from '../../types';
import type { IconName } from '../../types/icons';
import type { MenuItemProps } from '../ui/MenuItem';
import type { MediaViewerItem } from './helpers/getViewableMedia';

import {
  getIsDownloading,
  getMediaFilename,
  getMediaFormat,
  getMediaHash,
  isUserId,
} from '../../global/helpers';
import {
  selectActiveDownloads,
  selectAllowedMessageActionsSlow, selectCurrentChat,
  selectCurrentMessageList,
  selectIsChatProtected,
  selectIsMessageProtected,
  selectTabState,
} from '../../global/selectors';
import getViewableMedia from './helpers/getViewableMedia';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';
import useOldLang from '../../hooks/useOldLang';
import useZoomChange from './hooks/useZoomChangeSignal';

import DeleteProfilePhotoModal from '../common/DeleteProfilePhotoModal';
import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import ProgressSpinner from '../ui/ProgressSpinner';

import './MediaViewerActions.scss';

type StateProps = {
  activeDownloads: ActiveDownloads;
  isProtected?: boolean;
  isChatProtected?: boolean;
  canDelete?: boolean;
  chat?: ApiChat;
  canUpdate?: boolean;
  messageListType?: MessageListType;
  origin?: MediaViewerOrigin;
};

type OwnProps = {
  item?: MediaViewerItem;
  mediaData?: string;
  isVideo: boolean;
  canUpdateMedia?: boolean;
  canReportAvatar?: boolean;
  activeDownloads?: ActiveDownloads;
  onReportAvatar: NoneToVoidFunction;
  onBeforeDelete: NoneToVoidFunction;
  onCloseMediaViewer: NoneToVoidFunction;
  onForward: NoneToVoidFunction;
};

const MediaViewerActions: FC<OwnProps & StateProps> = ({
  item,
  mediaData,
  isVideo,
  chat,
  isChatProtected,
  isProtected,
  canReportAvatar,
  canDelete,
  canUpdate,
  messageListType,
  activeDownloads,
  origin,
  onReportAvatar: onReport,
  onCloseMediaViewer,
  onBeforeDelete,
  onForward,
}) => {
  const [isDeleteModalOpen, openDeleteModal, closeDeleteModal] = useFlag(false);
  const [getZoomChange, setZoomChange] = useZoomChange();
  const { isMobile } = useAppLayout();

  const {
    downloadMedia,
    cancelMediaDownload,
    updateProfilePhoto,
    updateChatPhoto,
    openMediaViewer,
    openDeleteMessageModal,
  } = getActions();

  const isMessage = item?.type === 'message';

  const { media } = getViewableMedia(item) || {};
  const fileName = media && getMediaFilename(media);
  const isDownloading = media && getIsDownloading(activeDownloads, media);

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    media && getMediaHash(media, 'download'),
    !isDownloading,
    media && getMediaFormat(media, 'download'),
  );

  const handleDownloadClick = useLastCallback(() => {
    if (!media) return;

    if (isDownloading) {
      cancelMediaDownload({ media });
    } else {
      const message = item?.type === 'message' ? item.message : undefined;
      downloadMedia({ media, originMessage: message });
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
    if (item?.type !== 'avatar') return;
    const { avatarOwner, profilePhotos, mediaIndex } = item;
    const avatarPhoto = profilePhotos?.photos[mediaIndex]!;
    if (isUserId(avatarOwner.id)) {
      updateProfilePhoto({ photo: avatarPhoto });
    } else {
      updateChatPhoto({ chatId: avatarOwner.id, photo: avatarPhoto });
    }

    openMediaViewer({
      origin: origin!,
      chatId: avatarOwner.id,
      mediaIndex: 0,
      isAvatarView: true,
    }, {
      forceOnHeavyAnimation: true,
    });
  });

  const lang = useOldLang();

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
        <Icon name="more" />
      </Button>
    );
  }, []);

  function renderDeleteModal() {
    return (item?.type === 'avatar') ? (
      <DeleteProfilePhotoModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={onBeforeDelete}
        profileId={item.avatarOwner.id}
        photo={item.profilePhotos.photos[item.mediaIndex!]}
      />
    ) : undefined;
  }

  function renderDownloadButton() {
    if (isProtected || item?.type === 'standalone') {
      return undefined;
    }

    return item?.type !== 'sponsoredMessage' && (isVideo ? (
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
          <Icon name="download" />
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
        <Icon name="download" />
      </Button>
    ));
  }

  const openDeleteModalHandler = useLastCallback(() => {
    if (item?.type === 'message' && chat) {
      openDeleteMessageModal({
        chatId: chat?.id,
        messageIds: [item.message.id],
        isSchedule: messageListType === 'scheduled',
        onConfirm: onBeforeDelete,
      });
    } else {
      openDeleteModal();
    }
  });

  if (isMobile) {
    const menuItems: MenuItemProps[] = [];
    if (isMessage && item.message.isForwardingAllowed && !item.message.content.action && !isChatProtected) {
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

    if (canReportAvatar) {
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
        onClick: openDeleteModalHandler,
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
              icon={icon as IconName}
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
        {canDelete && renderDeleteModal()}
      </div>
    );
  }

  return (
    <div className="MediaViewerActions">
      {isMessage && item.message.isForwardingAllowed && !isChatProtected && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Forward')}
          onClick={onForward}
        >
          <Icon name="forward" />
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
        <Icon name="zoom-out" />
      </Button>
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('MediaZoomIn')}
        onClick={handleZoomIn}
      >
        <Icon name="zoom-in" />
      </Button>
      {canReportAvatar && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang(isVideo ? 'PeerInfo.ReportProfileVideo' : 'PeerInfo.ReportProfilePhoto')}
          onClick={onReport}
        >
          <Icon name="flag" />
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
          <Icon name="copy-media" />
        </Button>
      )}
      {canDelete && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Delete')}
          onClick={openDeleteModalHandler}
        >
          <Icon name="delete" />
        </Button>
      )}
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('Close')}
        onClick={onCloseMediaViewer}
      >
        <Icon name="close" />
      </Button>
      {canDelete && renderDeleteModal()}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    item, canUpdateMedia,
  }): StateProps => {
    const tabState = selectTabState(global);
    const { origin } = tabState.mediaViewer;

    const message = item?.type === 'message' ? item.message : undefined;
    const avatarOwner = item?.type === 'avatar' ? item.avatarOwner : undefined;
    const avatarPhoto = item?.type === 'avatar' && item.profilePhotos.photos[item.mediaIndex];

    const chat = selectCurrentChat(global);
    const currentMessageList = selectCurrentMessageList(global);
    const { threadId } = selectCurrentMessageList(global) || {};
    const isProtected = selectIsMessageProtected(global, message);
    const activeDownloads = selectActiveDownloads(global);
    const isChatProtected = message && selectIsChatProtected(global, message?.chatId);
    const { canDelete: canDeleteMessage } = (threadId
      && message && selectAllowedMessageActionsSlow(global, message, threadId)) || {};
    const isCurrentAvatar = avatarPhoto && (avatarPhoto.id === avatarOwner?.avatarPhotoId);
    const canDeleteAvatar = canUpdateMedia && Boolean(avatarPhoto);
    const canDelete = canDeleteMessage || canDeleteAvatar;
    const canUpdate = canUpdateMedia && Boolean(avatarPhoto) && !isCurrentAvatar;
    const messageListType = currentMessageList?.type;

    return {
      activeDownloads,
      isProtected,
      chat,
      isChatProtected,
      canDelete,
      canUpdate,
      messageListType,
      origin,
    };
  },
)(MediaViewerActions));
