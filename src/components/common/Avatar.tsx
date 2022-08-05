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
import { ApiMediaFormat } from '../../api/types';

import { IS_TEST } from '../../config';
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

import './Avatar.scss';
import useVideoAutoPause from '../middle/message/hooks/useVideoAutoPause';

const cn = createClassNameBuilder('Avatar');
cn.media = cn('media');
cn.icon = cn('icon');

type OwnProps = {
  className?: string;
  size?: 'micro' | 'tiny' | 'small' | 'medium' | 'large' | 'jumbo';
  chat?: ApiChat;
  user?: ApiUser;
  photo?: ApiPhoto;
  userStatus?: ApiUserStatus;
  text?: string;
  isSavedMessages?: boolean;
  noVideo?: boolean;
  noLoop?: boolean;
  lastSyncTime?: number;
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
  noVideo,
  noLoop,
  lastSyncTime,
  observeIntersection,
  onClick,
}) => {
  const { loadFullUser } = getActions();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  const isIntersecting = useIsIntersecting(ref, observeIntersection);
  const isDeleted = user && isDeletedUser(user);
  const isReplies = user && isChatWithRepliesBot(user.id);
  let imageHash: string | undefined;
  let videoHash: string | undefined;

  const hasVideoAvatar = (user || chat)?.hasVideoAvatar;
  const profilePhoto = (user?.fullInfo?.profilePhoto || chat?.fullInfo?.profilePhoto);
  const shouldShowVideo = !noVideo && Boolean(user?.isPremium && profilePhoto?.isVideo);
  const shouldPlayVideo = isIntersecting && shouldShowVideo;

  const shouldFetchBig = size === 'jumbo';
  if (!isSavedMessages && !isDeleted) {
    if (shouldShowVideo) {
      videoHash = getChatAvatarHash(user!, undefined, 'video');
    }
    if (user) {
      imageHash = getChatAvatarHash(user, shouldFetchBig ? 'big' : undefined);
    } else if (chat) {
      imageHash = getChatAvatarHash(chat, shouldFetchBig ? 'big' : undefined);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
    }
  }

  useVideoAutoPause(videoRef, shouldPlayVideo);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !noLoop) return undefined;

    const returnToStart = () => {
      video.currentTime = 0;
    };

    video.addEventListener('ended', returnToStart);
    return () => video.removeEventListener('ended', returnToStart);
  }, [noLoop]);

  useEffect(() => {
    if (isIntersecting && !noVideo && user && hasVideoAvatar && !profilePhoto) {
      loadFullUser({ userId: user.id });
    }
  }, [hasVideoAvatar, profilePhoto, loadFullUser, user, noVideo, isIntersecting]);

  const imgBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const videoBlobUrl = useMedia(videoHash, false, ApiMediaFormat.BlobUrl, lastSyncTime);
  const hasBlobUrl = Boolean(imgBlobUrl || videoBlobUrl);
  const { transitionClassNames } = useShowTransition(hasBlobUrl, undefined, hasBlobUrl, 'slow');

  const lang = useLang();

  let content: TeactNode | undefined;
  const author = user ? getUserFullName(user) : (chat ? getChatTitle(lang, chat) : text);

  if (isSavedMessages) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-saved-messages')} aria-label={author} />;
  } else if (isDeleted) {
    content = <i className={buildClassName(cn.icon, 'icon-avatar-deleted-account')} aria-label={author} />;
  } else if (isReplies) {
    content = <i className={buildClassName(cn.icon, 'icon-reply-filled')} aria-label={author} />;
  } else if (hasBlobUrl) {
    content = (
      <>
        <img
          src={imgBlobUrl}
          className={buildClassName(cn.media, 'avatar-media', transitionClassNames, videoBlobUrl && 'poster')}
          alt={author}
          decoding="async"
        />
        {videoBlobUrl && (
          <video
            ref={videoRef}
            src={videoBlobUrl}
            className={buildClassName(cn.media, 'avatar-media', transitionClassNames)}
            muted
            autoPlay
            disablePictureInPicture
            loop={!noLoop}
            playsInline
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
