import type { FC, TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';

import type { ApiChat, ApiPhoto, ApiUser } from '../../api/types';

import {
  getChatAvatarHash,
  getChatTitle,
  getUserFullName,
  getVideoAvatarMediaHash,
  isAnonymousForwardsChat,
  isChatWithRepliesBot,
  isDeletedUser,
  isUserId,
} from '../../global/helpers';
import buildClassName from '../../util/buildClassName';
import { getFirstLetters } from '../../util/textFormat';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../util/windowEnvironment';
import { getPeerColorClass } from './helpers/peerColor';
import renderText from './helpers/renderText';

import useAppLayout from '../../hooks/useAppLayout';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import OptimizedVideo from '../ui/OptimizedVideo';
import Spinner from '../ui/Spinner';
import Icon from './Icon';

import './ProfilePhoto.scss';

type OwnProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  photo?: ApiPhoto;
  canPlayVideo: boolean;
  onClick: NoneToVoidFunction;
};

const ProfilePhoto: FC<OwnProps> = ({
  chat,
  user,
  photo,
  isSavedMessages,
  isSavedDialog,
  canPlayVideo,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  const lang = useLang();
  const { isMobile } = useAppLayout();

  const isDeleted = user && isDeletedUser(user);
  const isRepliesChat = chat && isChatWithRepliesBot(chat.id);
  const isAnonymousForwards = chat && isAnonymousForwardsChat(chat.id);
  const peer = user || chat;
  const canHaveMedia = peer && !isSavedMessages && !isDeleted && !isRepliesChat && !isAnonymousForwards;
  const { isVideo } = photo || {};

  const avatarHash = canHaveMedia && getChatAvatarHash(peer, 'normal');
  const avatarBlobUrl = useMedia(avatarHash);

  const photoHash = canHaveMedia && photo && !isVideo && `photo${photo.id}?size=c`;
  const photoBlobUrl = useMedia(photoHash);

  const videoHash = canHaveMedia && photo && isVideo && getVideoAvatarMediaHash(photo);
  const videoBlobUrl = useMedia(videoHash);

  const fullMediaData = videoBlobUrl || photoBlobUrl;
  const [isVideoReady, markVideoReady] = useFlag();
  const isFullMediaReady = Boolean(fullMediaData && (!isVideo || isVideoReady));
  const transitionClassNames = useMediaTransition(isFullMediaReady);
  const isBlurredThumb = canHaveMedia && !isFullMediaReady && !avatarBlobUrl && photo?.thumbnail?.dataUri;
  const blurredThumbCanvasRef = useCanvasBlur(
    photo?.thumbnail?.dataUri, !isBlurredThumb, isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );
  const hasMedia = photo || avatarBlobUrl || isBlurredThumb;

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
          <img src={avatarBlobUrl} draggable={false} className="thumb" alt="" />
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
    getPeerColorClass(peer),
    isSavedMessages && 'saved-messages',
    isAnonymousForwards && 'anonymous-forwards',
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
