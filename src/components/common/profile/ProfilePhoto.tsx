import type { TeactNode } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';

import type { ApiChat, ApiPhoto, ApiUser } from '../../../api/types';
import type { ThemeKey } from '../../../types';

import {
  getChatAvatarHash,
  getChatTitle,
  getPhotoMediaHash,
  getProfilePhotoMediaHash,
  getUserFullName,
  getVideoProfilePhotoMediaHash,
  isAnonymousForwardsChat,
  isChatWithRepliesBot,
  isDeletedUser,
} from '../../../global/helpers';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { isUserId } from '../../../util/entities/ids';
import { getFirstLetters } from '../../../util/textFormat';
import renderText from '../helpers/renderText';

import useAppLayout from '../../../hooks/useAppLayout';
import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useMedia from '../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../hooks/useMediaTransitionDeprecated';
import usePeerColor from '../../../hooks/usePeerColor';

import OptimizedVideo from '../../ui/OptimizedVideo';
import Spinner from '../../ui/Spinner';
import Icon from '../icons/Icon';

import './ProfilePhoto.scss';

type OwnProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  photo?: ApiPhoto;
  canPlayVideo: boolean;
  className?: string;
  style?: string;
  theme: ThemeKey;
  onClick: NoneToVoidFunction;
};

const ProfilePhoto = ({
  chat,
  user,
  photo,
  isSavedMessages,
  isSavedDialog,
  canPlayVideo,
  className,
  style,
  theme,
  onClick,
}: OwnProps) => {
  const videoRef = useRef<HTMLVideoElement>();

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const isDeleted = user && isDeletedUser(user);
  const isRepliesChat = chat && isChatWithRepliesBot(chat.id);
  const isAnonymousForwards = chat && isAnonymousForwardsChat(chat.id);
  const peer = (user || chat)!;
  const canHaveMedia = peer && !isSavedMessages && !isDeleted && !isRepliesChat && !isAnonymousForwards;
  const { isVideo } = photo || {};

  const avatarHash = (!photo || photo.id === peer.avatarPhotoId) && getChatAvatarHash(peer, 'normal');

  const previewHash = canHaveMedia && photo && !avatarHash && getPhotoMediaHash(photo, 'pictogram');
  const previewBlobUrl = useMedia(previewHash || avatarHash);

  const photoHash = canHaveMedia && photo && !isVideo && getProfilePhotoMediaHash(photo);
  const photoBlobUrl = useMedia(photoHash);

  const videoHash = canHaveMedia && photo && isVideo && getVideoProfilePhotoMediaHash(photo);
  const videoBlobUrl = useMedia(videoHash);

  const fullMediaData = videoBlobUrl || photoBlobUrl;
  const [isVideoReady, markVideoReady] = useFlag();
  const isFullMediaReady = Boolean(fullMediaData && (!isVideo || isVideoReady));
  const transitionClassNames = useMediaTransitionDeprecated(isFullMediaReady);
  const isBlurredThumb = canHaveMedia && !isFullMediaReady && !previewBlobUrl && photo?.thumbnail?.dataUri;
  const blurredThumbCanvasRef = useCanvasBlur(
    photo?.thumbnail?.dataUri, !isBlurredThumb, isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
  const hasMedia = photo || previewBlobUrl || isBlurredThumb;

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({ peer, theme });

  useEffect(() => {
    if (videoRef.current && !canPlayVideo) {
      videoRef.current.currentTime = 0;
    }
  }, [canPlayVideo]);

  const specialIcon = useMemo(() => {
    if (isSavedMessages) {
      return isSavedDialog ? 'my-notes' : 'avatar-saved-messages';
    }

    if (isDeleted) {
      return 'avatar-deleted-account';
    }

    if (isRepliesChat) {
      return 'reply-filled';
    }

    if (isAnonymousForwards) {
      return 'author-hidden';
    }

    return undefined;
  }, [isAnonymousForwards, isDeleted, isSavedDialog, isRepliesChat, isSavedMessages]);

  let content: TeactNode | undefined;

  if (specialIcon) {
    content = <Icon name={specialIcon} role="img" />;
  } else if (hasMedia) {
    content = (
      <>
        {isBlurredThumb ? (
          <canvas ref={blurredThumbCanvasRef} className="thumb" />
        ) : (
          <img src={previewBlobUrl} draggable={false} className="thumb" alt="" />
        )}
        {photo && (
          isVideo ? (
            <OptimizedVideo
              canPlay={canPlayVideo}
              ref={videoRef}
              src={fullMediaData}
              className={buildClassName('avatar-media', transitionClassNames)}
              muted
              disablePictureInPicture
              loop
              playsInline
              onReady={markVideoReady}
            />
          ) : (
            <img
              src={fullMediaData}
              draggable={false}
              className={buildClassName('avatar-media', transitionClassNames)}
              alt=""
            />
          )
        )}
      </>
    );
  } else if (user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (chat) {
    const title = getChatTitle(lang, chat);
    content = title && getFirstLetters(title, isUserId(chat.id) ? 2 : 1);
  } else {
    content = (
      <div className="spinner-wrapper">
        <Spinner color="white" />
      </div>
    );
  }

  const fullClassName = buildClassName(
    'ProfilePhoto',
    peerColorClass,
    isSavedMessages && 'saved-messages',
    isAnonymousForwards && 'anonymous-forwards',
    isDeleted && 'deleted-account',
    isRepliesChat && 'replies-bot-account',
    (!isSavedMessages && !hasMedia) && 'no-photo',
    className,
  );

  return (
    <div
      className={fullClassName}
      style={buildStyle(style, peerColorStyle)}
      onClick={hasMedia ? onClick : undefined}
    >
      {typeof content === 'string' ? renderText(content, ['hq_emoji']) : content}
    </div>
  );
};

export default memo(ProfilePhoto);
