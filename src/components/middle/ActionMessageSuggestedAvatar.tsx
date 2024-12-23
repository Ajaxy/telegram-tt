import type { FC } from '../../lib/teact/teact';
import React, { memo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { TextPart } from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';
import { MediaViewerOrigin, SettingsScreens } from '../../types';

import { getPhotoMediaHash, getVideoProfilePhotoMediaHash } from '../../global/helpers';
import { fetchBlob } from '../../util/files';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useOldLang from '../../hooks/useOldLang';

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

  const lang = useOldLang();
  const [cropModalBlob, setCropModalBlob] = useState<Blob | undefined>();
  const [isVideoModalOpen, openVideoModal, closeVideoModal] = useFlag(false);
  const photo = message.content.action!.photo!;
  const suggestedPhotoUrl = useMedia(getPhotoMediaHash(photo, 'full'));
  const suggestedVideoUrl = useMedia(getVideoProfilePhotoMediaHash(photo));
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
    if (!suggestedVideoUrl) return;

    closeVideoModal();
    showAvatarNotification();

    // TODO Once we support uploading video avatars, add crop/trim modal here
    const blob = await fetchBlob(suggestedVideoUrl);
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
        setCropModalBlob(await fetchBlob(suggestedPhotoUrl));
      }
    } else {
      openMediaViewer({
        chatId: message.chatId,
        messageId: message.id,
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
