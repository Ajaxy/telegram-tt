import type { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type {
  ApiChat, ApiPhoto, ApiUser, ApiUserStatus,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { AnimationLevel } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { ANIMATION_LEVEL_MAX, IS_TEST } from '../../config';
import { VIDEO_AVATARS_DISABLED } from '../../util/environment';
import {
  getChatAvatarHash,
  getChatTitle,
  getUserColorKey,
  getUserFullName,
  isUserId,
  isChatWithRepliesBot,
  isDeletedUser,
  isUserOnline,
} from '../../global/helpers';
import { getFirstLetters } from '../../util/textFormat';
import buildClassName, { createClassNameBuilder } from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useMedia from '../../hooks/useMedia';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';

import OptimizedVideo from '../ui/OptimizedVideo';

import './Avatar.scss';

const LOOP_COUNT = 3;

const cn = createClassNameBuilder('Avatar');
cn.media = cn('media');
cn.icon = cn('icon');

type OwnProps = {
  className?: string;
  size?: 'micro' | 'tiny' | 'mini' | 'small' | 'medium' | 'large' | 'jumbo';
  chat?: ApiChat;
  user?: ApiUser;
  photo?: ApiPhoto;
  userStatus?: ApiUserStatus;
  text?: string;
  isSavedMessages?: boolean;
  withVideo?: boolean;
  noLoop?: boolean;
  loopIndefinitely?: boolean;
  animationLevel?: AnimationLevel;
  noPersonalPhoto?: boolean;
  lastSyncTime?: number;
  showVideoOverwrite?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => void;
};

const Avatar: FC<OwnProps> = ({
  className,
  size = 'large',
  chat,
  user,
  photo,
  userStatus,
  text,
  isSavedMessages,
  withVideo,
  noLoop,
  loopIndefinitely,
  lastSyncTime,
  showVideoOverwrite,
  animationLevel,
  noPersonalPhoto,
  observeIntersection,
  onClick,
}) => {
  const { loadFullUser } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const videoLoopCountRef = useRef(0);
  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const isDeleted = user && isDeletedUser(user);
  const isReplies = user && isChatWithRepliesBot(user.id);
  const isForum = chat?.isForum;
  let imageHash: string | undefined;
  let videoHash: string | undefined;

  const shouldShowUserVideo = !VIDEO_AVATARS_DISABLED && animationLevel === ANIMATION_LEVEL_MAX
    && user?.isPremium && user?.hasVideoAvatar;
  const shouldShowPhotoVideo = showVideoOverwrite && photo?.isVideo;
  const shouldShowVideo = (
    isIntersecting && withVideo && (shouldShowPhotoVideo || shouldShowUserVideo)
  );
  const profilePhoto = user?.fullInfo?.personalPhoto || user?.fullInfo?.profilePhoto || user?.fullInfo?.fallbackPhoto;
  const hasProfileVideo = profilePhoto?.isVideo;
  const shouldLoadVideo = shouldShowVideo && (hasProfileVideo || shouldShowPhotoVideo);

  const shouldFetchBig = size === 'jumbo';
  if (!isSavedMessages && !isDeleted) {
    if (user && !noPersonalPhoto) {
      imageHash = getChatAvatarHash(user, shouldFetchBig ? 'big' : undefined);
    } else if (chat) {
      imageHash = getChatAvatarHash(chat, shouldFetchBig ? 'big' : undefined);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
      if (photo.isVideo && withVideo) {
        videoHash = `videoAvatar${photo.id}?size=u`;
      }
    }

    if (hasProfileVideo) {
      videoHash = getChatAvatarHash(user!, undefined, 'video');
    }
  }

  const imgBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const videoBlobUrl = useMedia(videoHash, !shouldLoadVideo, ApiMediaFormat.BlobUrl, lastSyncTime);
  const hasBlobUrl = Boolean(imgBlobUrl || videoBlobUrl);
  const shouldPlayVideo = Boolean(isIntersecting && videoBlobUrl);

  const { transitionClassNames } = useShowTransition(hasBlobUrl, undefined, hasBlobUrl, 'slow');

  const handleVideoEnded = useCallback((e) => {
    const video = e.currentTarget;
    if (!videoBlobUrl) return;

    if (loopIndefinitely) return;

    videoLoopCountRef.current += 1;
    if (videoLoopCountRef.current >= LOOP_COUNT || noLoop) {
      video.style.display = 'none';
    }
  }, [loopIndefinitely, noLoop, videoBlobUrl]);

  const userId = user?.id;
  useEffect(() => {
    if (userId && shouldShowVideo && !profilePhoto) {
      loadFullUser({ userId });
    }
  }, [loadFullUser, profilePhoto, userId, shouldShowVideo]);

  const lang = useLang();

  let content: TeactNode | undefined;
  const author = user ? getUserFullName(user) : (chat ? getChatTitle(lang, chat) : text);

  if (isSavedMessages) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-saved-messages')} role="img" aria-label={author} />;
  } else if (isDeleted) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-deleted-account')} role="img" aria-label={author} />;
  } else if (isReplies) {
    content = <i className={buildClassName(cn.icon, 'icon-reply-filled')} role="img" aria-label={author} />;
  } else if (hasBlobUrl) {
    content = (
      <>
        <img
          src={imgBlobUrl}
          className={buildClassName(cn.media, 'avatar-media', transitionClassNames, videoBlobUrl && 'poster')}
          alt={author}
          decoding="async"
        />
        {shouldPlayVideo && (
          <OptimizedVideo
            canPlay
            src={videoBlobUrl}
            className={buildClassName(cn.media, 'avatar-media', 'poster')}
            muted
            loop={loopIndefinitely}
            autoPlay
            disablePictureInPicture
            playsInline
            onEnded={handleVideoEnded}
          />
        )}
      </>
    );
  } else if (user) {
    const userFullName = getUserFullName(user);
    content = userFullName ? getFirstLetters(userFullName, 2) : undefined;
  } else if (chat) {
    const title = getChatTitle(lang, chat);
    content = title && getFirstLetters(title, isUserId(chat.id) ? 2 : 1);
  } else if (text) {
    content = getFirstLetters(text, 2);
  }

  const isOnline = !isSavedMessages && user && userStatus && isUserOnline(user, userStatus);
  const fullClassName = buildClassName(
    `Avatar size-${size}`,
    className,
    `color-bg-${getUserColorKey(user || chat)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isForum && 'forum',
    isOnline && 'online',
    onClick && 'interactive',
    (!isSavedMessages && !imgBlobUrl) && 'no-photo',
  );

  const hasMedia = Boolean(isSavedMessages || imgBlobUrl);
  const handleClick = useCallback((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (onClick) {
      onClick(e, hasMedia);
    }
  }, [onClick, hasMedia]);

  const senderId = (user || chat) && (user || chat)!.id;

  return (
    <div
      ref={ref}
      className={fullClassName}
      onClick={handleClick}
      data-test-sender-id={IS_TEST ? senderId : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
    >
      {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
    </div>
  );
};

export default memo(Avatar);
