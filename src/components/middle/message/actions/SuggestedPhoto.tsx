import { memo, useMemo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessageActionSuggestProfilePhoto } from '../../../../api/types/messageActions';
import { type ApiMessage, type ApiPeer, MAIN_THREAD_ID } from '../../../../api/types';
import { MediaViewerOrigin, SettingsScreens } from '../../../../types';

import { getPhotoMediaHash, getVideoProfilePhotoMediaHash } from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { fetchBlob } from '../../../../util/files';
import { renderPeerLink } from '../helpers/messageActions';

import useFlag from '../../../../hooks/useFlag';
import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMedia from '../../../../hooks/useMedia';

import Avatar from '../../../common/Avatar';
import ConfirmDialog from '../../../ui/ConfirmDialog';
import CropModal from '../../../ui/CropModal';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionSuggestProfilePhoto;
  observeIntersection?: ObserveFn;
};

type StateProps = {
  peer?: ApiPeer;
};

const SuggestedPhotoAction = ({
  message,
  action,
  peer,
  observeIntersection,
}: OwnProps & StateProps) => {
  const { openMediaViewer, uploadProfilePhoto, showNotification } = getActions();
  const { isOutgoing } = message;
  const photo = action.photo;

  const lang = useLang();
  const [cropModalBlob, setCropModalBlob] = useState<Blob | undefined>();
  const [isVideoModalOpen, openVideoModal, closeVideoModal] = useFlag(false);

  const suggestedPhotoUrl = useMedia(getPhotoMediaHash(photo, 'full'));
  const suggestedVideoUrl = useMedia(getVideoProfilePhotoMediaHash(photo));
  const isVideo = photo.isVideo;

  const text = useMemo(() => {
    const peerName = (peer && getPeerTitle(lang, peer)) || lang('ActionFallbackUser');
    const peerLink = renderPeerLink(peer?.id, peerName);

    if (isOutgoing) {
      return lang('ActionSuggestedPhotoYou', { user: peerLink }, { withNodes: true });
    }

    return lang('ActionSuggestedPhoto', { user: peerLink }, { withNodes: true });
  }, [lang, isOutgoing, peer]);

  const showAvatarNotification = useLastCallback(() => {
    showNotification({
      title: lang('ActionSuggestedPhotoUpdatedTitle'),
      message: lang('ActionSuggestedPhotoUpdatedDescription'),
      action: {
        action: 'openSettingsScreen',
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
    <div className={styles.contentBox} tabIndex={0} role="button" onClick={handleViewSuggestedAvatar}>
      <Avatar
        className={styles.suggestedAvatar}
        photo={action.photo}
        loopIndefinitely
        withVideo
        observeIntersection={observeIntersection}
        size="jumbo"
      />
      <div className={styles.suggestedText}>
        {text}
      </div>
      <div className={styles.actionButton}>
        {lang('ActionSuggestedPhotoButton')}
      </div>
      <CropModal
        file={cropModalBlob}
        onClose={handleCloseCropModal}
        onChange={handleSetSuggestedAvatar}
      />
      <ConfirmDialog
        isOpen={isVideoModalOpen}
        title={lang('ActionSuggestedVideoTitle')}
        confirmHandler={handleSetVideo}
        onClose={closeVideoModal}
        text={lang('ActionSuggestedVideoText')}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const peer = selectPeer(global, message.chatId);

    return {
      peer,
    };
  },
)(SuggestedPhotoAction));
