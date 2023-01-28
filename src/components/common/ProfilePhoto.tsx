import React, { memo, useEffect, useRef } from '../../lib/teact/teact';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type { ApiChat, ApiPhoto, ApiUser } from '../../api/types';

import { IS_CANVAS_FILTER_SUPPORTED } from '../../util/environment';
import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser, getVideoAvatarMediaHash,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import buildClassName from '../../util/buildClassName';
import { getFirstLetters } from '../../util/textFormat';
import useMedia from '../../hooks/useMedia';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';
import useMediaTransition from '../../hooks/useMediaTransition';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useAppLayout from '../../hooks/useAppLayout';

import Spinner from '../ui/Spinner';
import OptimizedVideo from '../ui/OptimizedVideo';

import './ProfilePhoto.scss';

type OwnProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isSavedMessages?: boolean;
  photo?: ApiPhoto;
  lastSyncTime?: number;
  canPlayVideo: boolean;
  onClick: NoneToVoidFunction;
};

const ProfilePhoto: FC<OwnProps> = ({
  chat,
  user,
  photo,
  isSavedMessages,
  canPlayVideo,
  lastSyncTime,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const isDeleted = user && isDeletedUser(user);
  const isRepliesChat = chat && isChatWithRepliesBot(chat.id);
  const userOrChat = user || chat;
  const currentPhoto = photo
    || user?.fullInfo?.personalPhoto
    || userOrChat?.fullInfo?.profilePhoto
    || user?.fullInfo?.fallbackPhoto;
  const canHaveMedia = userOrChat && !isSavedMessages && !isDeleted && !isRepliesChat;
  const { isVideo } = currentPhoto || {};

  const avatarHash = canHaveMedia && getChatAvatarHash(userOrChat, 'normal', 'photo');
  const avatarBlobUrl = useMedia(avatarHash, undefined, undefined, lastSyncTime);

  const photoHash = canHaveMedia && currentPhoto && !isVideo && `photo${currentPhoto.id}?size=c`;
  const photoBlobUrl = useMedia(photoHash, undefined, undefined, lastSyncTime);

  const videoHash = canHaveMedia && currentPhoto && isVideo && getVideoAvatarMediaHash(currentPhoto);
  const videoBlobUrl = useMedia(videoHash, undefined, undefined, lastSyncTime);

  const fullMediaData = videoBlobUrl || photoBlobUrl;
  const [isVideoReady, markVideoReady] = useFlag();
  const isFullMediaReady = Boolean(fullMediaData && (!isVideo || isVideoReady));
  const transitionClassNames = useMediaTransition(isFullMediaReady);
  const isBlurredThumb = canHaveMedia && !isFullMediaReady && !avatarBlobUrl && currentPhoto?.thumbnail?.dataUri;
  const blurredThumbCanvasRef = useCanvasBlur(
    currentPhoto?.thumbnail?.dataUri, !isBlurredThumb, isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
  const hasMedia = currentPhoto || avatarBlobUrl || isBlurredThumb;

  useEffect(() => {
    if (videoRef.current && !canPlayVideo) {
      videoRef.current.currentTime = 0;
    }
  }, [canPlayVideo]);

  let content: TeactNode | undefined;

  if (isSavedMessages) {
    content = <i className="icon-avatar-saved-messages" />;
  } else if (isDeleted) {
    content = <i className="icon-avatar-deleted-account" />;
  } else if (isRepliesChat) {
    content = <i className="icon-reply-filled" />;
  } else if (hasMedia) {
    content = (
      <>
        {isBlurredThumb ? (
          <canvas ref={blurredThumbCanvasRef} className="thumb" />
        ) : (
          <img src={avatarBlobUrl} className="thumb" alt="" />
        )}
        {currentPhoto && (
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
    `color-bg-${getUserColorKey(user || chat)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isRepliesChat && 'replies-bot-account',
    (!isSavedMessages && !hasMedia) && 'no-photo',
  );

  return (
    <div className={fullClassName} onClick={hasMedia ? onClick : undefined}>
      {typeof content === 'string' ? renderText(content, ['hq_emoji']) : content}
    </div>
  );
};

export default memo(ProfilePhoto);
