import {
  memo, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiMessageActionSuggestProfilePhoto } from '../../../../api/types/messageActions';
import {
  type ApiAvatarUpload, ApiMediaFormat, type ApiMessage, type ApiPeer, MAIN_THREAD_ID,
} from '../../../../api/types';
import { MediaViewerOrigin, SettingsScreens } from '../../../../types';

import { getPhotoMediaHash, getVideoProfilePhotoStartTs } from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import { fetchBlob } from '../../../../util/files';
import * as mediaLoader from '../../../../util/mediaLoader';
import { renderPeerLink } from '../helpers/messageActions';

import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Avatar from '../../../common/Avatar';
import AvatarEditor from '../../../ui/AvatarEditor';

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
  const [editorBlob, setEditorBlob] = useState<Blob | undefined>();
  const editorRequestIdRef = useRef(0);

  const isVideo = photo.isVideo;
  const mediaHash = getPhotoMediaHash(photo, 'download');

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

  const handleSetSuggestedAvatar = useLastCallback((avatar: ApiAvatarUpload) => {
    setEditorBlob(undefined);
    uploadProfilePhoto({ photo: avatar });
    showAvatarNotification();
  });

  const handleCloseEditor = useLastCallback(() => {
    setEditorBlob(undefined);
  });

  const handleViewSuggestedAvatar = useLastCallback(async () => {
    if (isOutgoing || !mediaHash) {
      openMediaViewer({
        chatId: message.chatId,
        messageId: message.id,
        threadId: MAIN_THREAD_ID,
        origin: MediaViewerOrigin.SuggestedAvatar,
      });
      return;
    }

    const requestId = ++editorRequestIdRef.current;
    const url = await mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl);
    const blob = url && await fetchBlob(url);
    if (blob && requestId === editorRequestIdRef.current) setEditorBlob(blob);
  });

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
      <AvatarEditor
        file={editorBlob}
        isOwn
        initialCoverTime={isVideo ? getVideoProfilePhotoStartTs(photo) : undefined}
        onChange={handleSetSuggestedAvatar}
        onClose={handleCloseEditor}
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
