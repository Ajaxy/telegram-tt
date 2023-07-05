import type { MouseEvent as ReactMouseEvent } from 'react';
import React, {
  memo, useRef,
} from '../../lib/teact/teact';

import type { FC, TeactNode } from '../../lib/teact/teact';
import type {
  ApiChat, ApiPhoto, ApiUser,
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
} from '../../global/helpers';
import { getFirstLetters } from '../../util/textFormat';
import buildClassName, { createClassNameBuilder } from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import useLang from '../../hooks/useLang';
import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';

import OptimizedVideo from '../ui/OptimizedVideo';

import './Avatar.scss';

const LOOP_COUNT = 3;

export type AvatarSize = 'micro' | 'tiny' | 'mini' | 'small' | 'small-mobile' | 'medium' | 'large' | 'jumbo';

const cn = createClassNameBuilder('Avatar');
cn.media = cn('media');
cn.icon = cn('icon');

type OwnProps = {
  className?: string;
  size?: AvatarSize;
  peer?: ApiChat | ApiUser;
  photo?: ApiPhoto;
  text?: string;
  isSavedMessages?: boolean;
  withVideo?: boolean;
  loopIndefinitely?: boolean;
  noPersonalPhoto?: boolean;
  observeIntersection?: ObserveFn;
  onClick?: (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => void;
};

const Avatar: FC<OwnProps> = ({
  className,
  size = 'large',
  peer,
  photo,
  text,
  isSavedMessages,
  withVideo,
  loopIndefinitely,
  noPersonalPhoto,
  onClick,
}) => {
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const videoLoopCountRef = useRef(0);
  const isPeerChat = peer && 'title' in peer;
  const user = peer && !isPeerChat ? peer as ApiUser : undefined;
  const chat = peer && isPeerChat ? peer as ApiChat : undefined;
  const isDeleted = user && isDeletedUser(user);
  const isReplies = peer && isChatWithRepliesBot(peer.id);
  const isForum = chat?.isForum;
  let imageHash: string | undefined;
  let videoHash: string | undefined;

  const shouldLoadVideo = withVideo && photo?.isVideo;

  const shouldFetchBig = size === 'jumbo';
  if (!isSavedMessages && !isDeleted) {
    if ((user && !noPersonalPhoto) || chat) {
      imageHash = getChatAvatarHash(peer!, shouldFetchBig ? 'big' : undefined);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
      if (photo.isVideo && withVideo) {
        videoHash = `videoAvatar${photo.id}?size=u`;
      }
    }
  }

  const imgBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const videoBlobUrl = useMedia(videoHash, !shouldLoadVideo, ApiMediaFormat.BlobUrl);
  const hasBlobUrl = Boolean(imgBlobUrl || videoBlobUrl);
  // `videoBlobUrl` can be taken from memory cache, so we need to check `shouldLoadVideo` again
  const shouldPlayVideo = Boolean(videoBlobUrl && shouldLoadVideo);

  const transitionClassNames = useMediaTransition(hasBlobUrl);

  const handleVideoEnded = useLastCallback((e) => {
    const video = e.currentTarget;
    if (!videoBlobUrl) return;

    if (loopIndefinitely) return;

    videoLoopCountRef.current += 1;
    if (videoLoopCountRef.current >= LOOP_COUNT) {
      video.style.display = 'none';
    }
  });

  const lang = useLang();

  let content: TeactNode | undefined;
  const author = user ? getUserFullName(user) : (chat ? getChatTitle(lang, chat) : text);

  if (isSavedMessages) {
    content = (
      <i
        className={buildClassName(
          cn.icon,
          'icon',
          'icon-avatar-saved-messages',
        )}
        role="img"
        aria-label={author}
      />
    );
  } else if (isDeleted) {
    content = (
      <i
        className={buildClassName(
          cn.icon,
          'icon',
          'icon-avatar-deleted-account',
        )}
        role="img"
        aria-label={author}
      />
    );
  } else if (isReplies) {
    content = (
      <i
        className={buildClassName(
          cn.icon,
          'icon',
          'icon-reply-filled',
        )}
        role="img"
        aria-label={author}
      />
    );
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

  const fullClassName = buildClassName(
    `Avatar size-${size}`,
    className,
    `color-bg-${getUserColorKey(peer)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isForum && 'forum',
    onClick && 'interactive',
    (!isSavedMessages && !imgBlobUrl) && 'no-photo',
  );

  const hasMedia = Boolean(isSavedMessages || imgBlobUrl);

  const { handleClick, handleMouseDown } = useFastClick((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (onClick) {
      onClick(e, hasMedia);
    }
  });

  return (
    <div
      ref={ref}
      className={fullClassName}
      data-test-sender-id={IS_TEST ? peer?.id : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
    </div>
  );
};

export default memo(Avatar);
