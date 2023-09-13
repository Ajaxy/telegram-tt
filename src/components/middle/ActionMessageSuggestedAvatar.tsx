import type { FC } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { TextPart } from '../../types';
import { ApiMediaFormat, MAIN_THREAD_ID } from '../../api/types';
import { MediaViewerOrigin, SettingsScreens } from '../../types';

import { getMessageMediaHash } from '../../global/helpers';
import * as mediaLoader from '../../util/mediaLoader';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';

import Avatar from '../common/Avatar';
import ConfirmDialog from '../ui/ConfirmDialog';
import CropModal from '../ui/CropModal';

type OwnProps = {
  message: ApiMessage;
  renderContent: () => TextPart | undefined;
};

const ActionMessageSuggestedAvatar: FC<OwnProps> = ({
  message,
  renderContent,
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

  const showAvatarNotification = useLastCallback(() => {
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
  });

  const handleSetSuggestedAvatar = useLastCallback((file: File) => {
    setCropModalBlob(undefined);
    uploadProfilePhoto({ file });
    showAvatarNotification();
  });

  const handleCloseCropModal = useLastCallback(() => {
    setCropModalBlob(undefined);
  });

  const handleSetVideo = useLastCallback(async () => {
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
  });

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
        loopIndefinitely
        withVideo={isVideo}
        size="jumbo"
      />
      <span>{renderContent()}</span>

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
        textParts={renderContent()}
      />
    </span>
  );
};

export default memo(ActionMessageSuggestedAvatar);
