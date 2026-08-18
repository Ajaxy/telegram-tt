import type { FC } from '../../lib/teact/teact';
import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiChat, ApiChatFullInfo } from '../../api/types';
import type { ActiveDownloads, MediaViewerOrigin, MessageListType } from '../../types';
import type { IconName } from '../../types/icons';
import type { MenuItemProps } from '../ui/MenuItem';
import type { MediaViewerItem, ViewableMedia } from './helpers/getViewableMedia';

import {
  canEditMediaInEditor,
  getAllowedAttachmentOptions,
  getIsDownloading,
  getMediaFilename,
  getMediaFormat,
  getMediaHash,
} from '../../global/helpers';
import {
  selectActiveDownloads,
  selectAllowedMessageActionsSlow, selectCanForwardMessage,
  selectChatFullInfo, selectCurrentChat,
  selectCurrentMessageList,
  selectIsChatProtected,
  selectIsMessageProtected,
  selectPerformanceSettingsValue,
  selectTabState,
} from '../../global/selectors';
import { isUserId } from '../../util/entities/ids';
import selectViewableMedia from './helpers/getViewableMedia';

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

// Safety fallback: if the editor never opens to take over closing the viewer, close it ourselves
const EDITOR_OPEN_TIMEOUT = 3000;

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

type StateProps = {
  activeDownloads: ActiveDownloads;
  isProtected?: boolean;
  isChatProtected?: boolean;
  canDelete?: boolean;
  canForward?: boolean;
  canReportMessage?: boolean;
  chat?: ApiChat;
  chatFullInfo?: ApiChatFullInfo;
  canUpdate?: boolean;
  withAnimation?: boolean;
  messageListType?: MessageListType;
  origin?: MediaViewerOrigin;
  viewableMedia?: ViewableMedia;
};

const MediaViewerActions: FC<OwnProps & StateProps> = ({
  item,
  mediaData,
  isVideo,
  chat,
  chatFullInfo,
  isChatProtected,
  isProtected,
  canReportAvatar,
  canReportMessage,
  canDelete,
  canForward,
  canUpdate,
  withAnimation,
  messageListType,
  activeDownloads,
  origin,
  viewableMedia,
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
    closeMediaViewer,
    openDeleteMessageModal,
    deleteEphemeralMessage,
    reportMessages,
    requestMessageMediaEditor,
  } = getActions();

  const isMessage = item?.type === 'message';
  const message = item?.type === 'message' ? item.message : undefined;

  const { canSendPhotos } = getAllowedAttachmentOptions(chat, chatFullInfo);
  const canEditViewedMedia = Boolean(
    message && !message.isEphemeral && !isMobile && !isProtected && !isChatProtected
    && message.chatId === chat?.id
    && canSendPhotos
    && canEditMediaInEditor(message),
  );

  const { media } = viewableMedia || {};
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

  const handleEditClick = useLastCallback(() => {
    if (!message) return;
    requestMessageMediaEditor({ chatId: message.chatId, messageId: message.id });
    if (!withAnimation) {
      closeMediaViewer();
      return;
    }
    // Keep the viewer open as an opaque backdrop: the editor fades in above it (as a top-layer
    // popover) and closes it once its canvas is ready (see `MediaEditor`). Safety net closes the
    // viewer in case the editor never opens (e.g. the media fails to load) — guarded so it only
    // acts while a viewer is still on screen.
    setTimeout(() => {
      if (document.getElementById('MediaViewer')) {
        closeMediaViewer();
      }
    }, EDITOR_OPEN_TIMEOUT);
  });

  const handleUpdate = useLastCallback(() => {
    if (item?.type !== 'avatar') return;
    const { avatarOwner, profilePhotos, mediaIndex } = item;
    const avatarPhoto = profilePhotos?.photos[mediaIndex];
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
        iconName="more"
      />
    );
  }, []);

  function renderDeleteModal() {
    return (item?.type === 'avatar') ? (
      <DeleteProfilePhotoModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={onBeforeDelete}
        profileId={item.avatarOwner.id}
        photo={item.profilePhotos.photos[item.mediaIndex]}
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
        iconName="download"
      />
    ));
  }

  const openDeleteModalHandler = useLastCallback(() => {
    if (item?.type === 'message' && chat) {
      if (item.message.isEphemeral) {
        deleteEphemeralMessage({
          chatId: item.message.chatId,
          messageId: item.message.id,
        });
        onBeforeDelete();
        return;
      }

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

  const handleReportMessage = useLastCallback(() => {
    if (!message) return;
    reportMessages({
      chatId: message.chatId,
      messageIds: [message.id],
    });
  });

  if (isMobile) {
    const menuItems: MenuItemProps[] = [];
    if (isMessage && canForward) {
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

    if (canReportMessage) {
      menuItems.push({
        icon: 'flag',
        onClick: handleReportMessage,
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
      {canEditViewedMedia && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Edit')}
          onClick={handleEditClick}
          iconName="edit"
        />
      )}
      {isMessage && canForward && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Forward')}
          onClick={onForward}
          iconName="forward"
        />
      )}
      {renderDownloadButton()}
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('MediaZoomOut')}
        onClick={handleZoomOut}
        iconName="zoom-out"
      />
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('MediaZoomIn')}
        onClick={handleZoomIn}
        iconName="zoom-in"
      />
      {canReportAvatar && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang(isVideo ? 'PeerInfo.ReportProfileVideo' : 'PeerInfo.ReportProfilePhoto')}
          onClick={onReport}
          iconName="flag"
        />
      )}
      {canReportMessage && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('ReportPeer.Report')}
          onClick={handleReportMessage}
          iconName="flag"
        />
      )}
      {canUpdate && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('ProfilePhoto.SetMainPhoto')}
          onClick={handleUpdate}
          iconName="copy-media"
        />
      )}
      {canDelete && (
        <Button
          round
          size="smaller"
          color="translucent-white"
          ariaLabel={lang('Delete')}
          onClick={openDeleteModalHandler}
          iconName="delete"
        />
      )}
      <Button
        round
        size="smaller"
        color="translucent-white"
        ariaLabel={lang('Close')}
        onClick={onCloseMediaViewer}
        iconName="close"
      />
      {canDelete && renderDeleteModal()}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    item, canUpdateMedia,
  }): Complete<StateProps> => {
    const tabState = selectTabState(global);
    const { origin } = tabState.mediaViewer;

    const message = item?.type === 'message' ? item.message : undefined;
    const pageMedia = item?.type === 'pageBlock' ? item.pageMedia : undefined;
    const avatarOwner = item?.type === 'avatar' ? item.avatarOwner : undefined;
    const avatarPhoto = item?.type === 'avatar' && item.profilePhotos.photos[item.mediaIndex];

    const chat = selectCurrentChat(global);
    const chatFullInfo = chat && !isUserId(chat.id) ? selectChatFullInfo(global, chat.id) : undefined;
    const currentMessageList = selectCurrentMessageList(global);
    const { threadId } = selectCurrentMessageList(global) || {};
    const isProtected = pageMedia?.isProtected || selectIsMessageProtected(global, message);
    const activeDownloads = selectActiveDownloads(global);
    const isChatProtected = message && selectIsChatProtected(global, message?.chatId);
    const { canDelete: canDeleteMessage } = (threadId
      && message && selectAllowedMessageActionsSlow(global, message, threadId)) || {};
    const isCurrentAvatar = avatarPhoto && (avatarPhoto.id === avatarOwner?.avatarPhotoId);
    const canDeleteAvatar = canUpdateMedia && Boolean(avatarPhoto);
    const canDelete = message?.isEphemeral || canDeleteMessage || canDeleteAvatar;
    const canForward = message && selectCanForwardMessage(global, message);
    const canUpdate = canUpdateMedia && Boolean(avatarPhoto) && !isCurrentAvatar;
    const messageListType = currentMessageList?.type;
    const viewableMedia = selectViewableMedia(global, origin, item);
    const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

    return {
      activeDownloads,
      isProtected,
      chat,
      chatFullInfo,
      isChatProtected,
      canDelete,
      canForward,
      canReportMessage: Boolean(message?.isEphemeral && !message.isOutgoing),
      canUpdate,
      withAnimation,
      messageListType,
      origin,
      viewableMedia,
    };
  },
)(MediaViewerActions));
