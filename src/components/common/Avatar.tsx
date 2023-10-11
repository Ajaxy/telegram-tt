import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiChat, ApiPeer, ApiPhoto, ApiUser,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { StoryViewerOrigin } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { IS_STORIES_ENABLED, IS_TEST } from '../../config';
import {
  getChatAvatarHash,
  getChatTitle,
  getPeerColorKey,
  getPeerStoryHtmlId,
  getUserFullName,
  isChatWithRepliesBot,
  isDeletedUser,
  isUserId,
} from '../../global/helpers';
import buildClassName, { createClassNameBuilder } from '../../util/buildClassName';
import { getFirstLetters } from '../../util/textFormat';
import renderText from './helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import OptimizedVideo from '../ui/OptimizedVideo';
import AvatarStoryCircle from './AvatarStoryCircle';

import './Avatar.scss';

const LOOP_COUNT = 3;

export type AvatarSize = 'micro' | 'tiny' | 'mini' | 'small' | 'small-mobile' | 'medium' | 'large' | 'giant' | 'jumbo';

const cn = createClassNameBuilder('Avatar');
cn.media = cn('media');
cn.icon = cn('icon');

type OwnProps = {
  className?: string;
  size?: AvatarSize;
  peer?: ApiPeer;
  photo?: ApiPhoto;
  text?: string;
  isSavedMessages?: boolean;
  withVideo?: boolean;
  withStory?: boolean;
  forPremiumPromo?: boolean;
  withStoryGap?: boolean;
  withStorySolid?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  storyViewerMode?: 'full' | 'single-peer' | 'disabled';
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
  withStory,
  forPremiumPromo,
  withStoryGap,
  withStorySolid,
  storyViewerOrigin,
  storyViewerMode = 'single-peer',
  loopIndefinitely,
  noPersonalPhoto,
  onClick,
}) => {
  const { openStoryViewer } = getActions();

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
          draggable={false}
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
            draggable={false}
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
    `color-bg-${getPeerColorKey(peer)}`,
    isSavedMessages && 'saved-messages',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isForum && 'forum',
    IS_STORIES_ENABLED && ((withStory && peer?.hasStories) || forPremiumPromo) && 'with-story-circle',
    IS_STORIES_ENABLED && withStorySolid && peer?.hasStories && 'with-story-solid',
    IS_STORIES_ENABLED && withStorySolid && peer?.hasUnreadStories && 'has-unread-story',
    onClick && 'interactive',
    (!isSavedMessages && !imgBlobUrl) && 'no-photo',
  );

  const hasMedia = Boolean(isSavedMessages || imgBlobUrl);

  const { handleClick, handleMouseDown } = useFastClick((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (IS_STORIES_ENABLED && withStory && storyViewerMode !== 'disabled' && peer?.hasStories) {
      e.stopPropagation();

      openStoryViewer({
        peerId: peer.id,
        isSinglePeer: storyViewerMode === 'single-peer',
        origin: storyViewerOrigin,
      });
      return;
    }

    if (onClick) {
      onClick(e, hasMedia);
    }
  });

  return (
    <div
      ref={ref}
      className={fullClassName}
      id={peer?.id && withStory ? getPeerStoryHtmlId(peer.id) : undefined}
      data-peer-id={peer?.id}
      data-test-sender-id={IS_TEST ? peer?.id : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <div className="inner">
        {typeof content === 'string' ? renderText(content, [size === 'jumbo' ? 'hq_emoji' : 'emoji']) : content}
      </div>
      {IS_STORIES_ENABLED && withStory && peer?.hasStories && (
        <AvatarStoryCircle peerId={peer.id} size={size} withExtraGap={withStoryGap} />
      )}
    </div>
  );
};

export default memo(Avatar);
