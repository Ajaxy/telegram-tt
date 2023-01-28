import React, { memo, useCallback, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiMessage } from '../../api/types';
import type { TextPart } from '../../types';
import { MediaViewerOrigin, SettingsScreens } from '../../types';
import { ApiMediaFormat, MAIN_THREAD_ID } from '../../api/types';

import { getMessageMediaHash } from '../../global/helpers';
import * as mediaLoader from '../../util/mediaLoader';
import useMedia from '../../hooks/useMedia';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Avatar from '../common/Avatar';
import CropModal from '../ui/CropModal';
import ConfirmDialog from '../ui/ConfirmDialog';

type OwnProps = {
  message: ApiMessage;
  content?: TextPart;
};

const ActionMessageSuggestedAvatar: FC<OwnProps> = ({
  message,
  content,
}) => {
  const {
    openMediaViewer, uploadProfilePhoto, showNotification,
  } = getActions();

  const { isOutgoing } = message;

  const lang = useLang();
  const [cropModalBlob, setCropModalBlob] = useState<Blob | undefined>();
  const [isVideoModalOpen, openVideoModal, closeVideoModal] = useFlag(false);
  const suggestedPhotoUrl = useMedia(getMessageMediaHash(message, 'full'));
  const isVideo = message.content.action!.photo?.isVideo;

  const showAvatarNotification = useCallback(() => {
    showNotification({
      title: lang('ApplyAvatarHintTitle'),
      message: lang('ApplyAvatarHint'),
      action: {
        action: 'requestNextSettingsScreen',
        payload: {
          screen: SettingsScreens.Main,
        },
      },
      actionText: lang('Open'),
    });
  }, [lang, showNotification]);

  const handleSetSuggestedAvatar = useCallback((file: File) => {
    setCropModalBlob(undefined);
    uploadProfilePhoto({ file });
    showAvatarNotification();
  }, [showAvatarNotification, uploadProfilePhoto]);

  const handleCloseCropModal = useCallback(() => {
    setCropModalBlob(undefined);
  }, []);

  const handleSetVideo = useCallback(async () => {
    closeVideoModal();
    showAvatarNotification();

    // TODO Once we support uploading video avatars, add crop/trim modal here
    const photo = message.content.action!.photo!;
    const blobUrl = await mediaLoader.fetch(`videoAvatar${photo.id}?size=u`, ApiMediaFormat.BlobUrl);
    const blob = await fetch(blobUrl).then((r) => r.blob());
    uploadProfilePhoto({
      file: new File([blob], 'avatar.mp4'),
      isVideo: true,
      videoTs: photo.videoSizes?.find((l) => l.videoStartTs !== undefined)?.videoStartTs,
    });
  }, [closeVideoModal, message.content.action, showAvatarNotification, uploadProfilePhoto]);

  const handleViewSuggestedAvatar = async () => {
    if (!isOutgoing && suggestedPhotoUrl) {
      if (isVideo) {
        openVideoModal();
      } else {
        setCropModalBlob(await fetch(suggestedPhotoUrl).then((r) => r.blob()));
      }
    } else {
      openMediaViewer({
        chatId: message.chatId,
        mediaId: message.id,
        threadId: MAIN_THREAD_ID,
        origin: MediaViewerOrigin.SuggestedAvatar,
      });
    }
  };

  return (
    <span className="action-message-suggested-avatar" tabIndex={0} role="button" onClick={handleViewSuggestedAvatar}>
      <Avatar
        photo={message.content.action!.photo}
        showVideoOverwrite
        loopIndefinitely
        withVideo={isVideo}
        size="jumbo"
      />
      <span>{content}</span>

      <span className="action-message-button">{lang(isVideo ? 'ViewVideoAction' : 'ViewPhotoAction')}</span>
      <CropModal
        file={cropModalBlob}
        onClose={handleCloseCropModal}
        onChange={handleSetSuggestedAvatar}
      />
      <ConfirmDialog
        isOpen={isVideoModalOpen}
        title={lang('SuggestedVideo')}
        confirmHandler={handleSetVideo}
        onClose={closeVideoModal}
        textParts={content}
      />
    </span>
  );
};

export default memo(ActionMessageSuggestedAvatar);
