import type { MouseEvent as ReactMouseEvent } from 'react';
import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type {
  ApiPeer, ApiPhoto, ApiWebDocument,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { CustomPeer, StoryViewerOrigin } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { IS_TEST } from '../../config';
import {
  getChatAvatarHash,
  getChatTitle,
  getPeerStoryHtmlId,
  getUserFullName,
  getVideoProfilePhotoMediaHash,
  getWebDocumentHash,
  isAnonymousForwardsChat,
  isChatWithRepliesBot,
  isDeletedUser,
  isPeerChat,
  isPeerUser,
  isUserId,
} from '../../global/helpers';
import buildClassName, { createClassNameBuilder } from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { getFirstLetters } from '../../util/textFormat';
import { REM } from './helpers/mediaDimensions';
import { getPeerColorClass } from './helpers/peerColor';
import renderText from './helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';
import useOldLang from '../../hooks/useOldLang';

import OptimizedVideo from '../ui/OptimizedVideo';
import AvatarStoryCircle from './AvatarStoryCircle';
import Icon from './icons/Icon';

import './Avatar.scss';

const LOOP_COUNT = 3;

export const AVATAR_SIZES = {
  micro: REM,
  mini: 1.5 * REM,
  tiny: 2 * REM,
  small: 2.125 * REM,
  medium: 2.75 * REM,
  large: 3.375 * REM,
  giant: 5.625 * REM,
  jumbo: 7.5 * REM,
};

export type AvatarSize =
  'micro' | 'mini' | 'tiny' | 'small' | 'medium' | 'large' | 'giant' | 'jumbo' | number;

const cn = createClassNameBuilder('Avatar');
cn.media = cn('media');
cn.icon = cn('icon');

type OwnProps = {
  className?: string;
  size?: AvatarSize;
  peer?: ApiPeer | CustomPeer;
  photo?: ApiPhoto;
  webPhoto?: ApiWebDocument;
  text?: string;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  withVideo?: boolean;
  withStory?: boolean;
  forPremiumPromo?: boolean;
  withStoryGap?: boolean;
  withStorySolid?: boolean;
  forceFriendStorySolid?: boolean;
  forceUnreadStorySolid?: boolean;
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
  webPhoto,
  text,
  isSavedMessages,
  isSavedDialog,
  withVideo,
  withStory,
  forPremiumPromo,
  withStoryGap,
  withStorySolid,
  forceFriendStorySolid,
  forceUnreadStorySolid,
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
  const isCustomPeer = peer && 'isCustomPeer' in peer;
  const realPeer = peer && !isCustomPeer ? peer : undefined;
  const user = realPeer && isPeerUser(realPeer) ? realPeer : undefined;
  const chat = realPeer && isPeerChat(realPeer) ? realPeer : undefined;
  const isDeleted = user && isDeletedUser(user);
  const isReplies = realPeer && isChatWithRepliesBot(realPeer.id);
  const isAnonymousForwards = realPeer && isAnonymousForwardsChat(realPeer.id);
  const isForum = chat?.isForum;
  let imageHash: string | undefined;
  let videoHash: string | undefined;

  const pxSize = typeof size === 'number' ? size : AVATAR_SIZES[size];

  const shouldLoadVideo = withVideo && photo?.isVideo;

  const isBig = pxSize >= AVATAR_SIZES.jumbo;
  if (!isSavedMessages && !isDeleted) {
    if ((user && !noPersonalPhoto) || chat) {
      imageHash = getChatAvatarHash(peer as ApiPeer, isBig ? 'big' : undefined);
    } else if (photo) {
      imageHash = `photo${photo.id}?size=m`;
      if (photo.isVideo && withVideo) {
        videoHash = getVideoProfilePhotoMediaHash(photo);
      }
    } else if (webPhoto) {
      imageHash = getWebDocumentHash(webPhoto);
    }
  }

  const specialIcon = useMemo(() => {
    if (isCustomPeer) {
      return peer.avatarIcon;
    }

    if (isSavedMessages) {
      return isSavedDialog ? 'my-notes' : 'avatar-saved-messages';
    }

    if (isDeleted) {
      return 'avatar-deleted-account';
    }

    if (isReplies) {
      return 'reply-filled';
    }

    if (isAnonymousForwards) {
      return 'author-hidden';
    }

    return undefined;
  }, [isCustomPeer, isSavedMessages, isDeleted, isReplies, isAnonymousForwards, peer, isSavedDialog]);

  const imgBlobUrl = useMedia(imageHash, false, ApiMediaFormat.BlobUrl);
  const videoBlobUrl = useMedia(videoHash, !shouldLoadVideo, ApiMediaFormat.BlobUrl);
  const hasBlobUrl = Boolean(imgBlobUrl || videoBlobUrl);
  // `videoBlobUrl` can be taken from memory cache, so we need to check `shouldLoadVideo` again
  const shouldPlayVideo = Boolean(videoBlobUrl && shouldLoadVideo);

  const transitionClassNames = useMediaTransitionDeprecated(hasBlobUrl);

  const handleVideoEnded = useLastCallback((e) => {
    const video = e.currentTarget;
    if (!videoBlobUrl) return;

    if (loopIndefinitely) return;

    videoLoopCountRef.current += 1;
    if (videoLoopCountRef.current >= LOOP_COUNT) {
      video.style.display = 'none';
    }
  });

  const lang = useOldLang();

  let content: TeactNode | undefined;
  const author = user ? getUserFullName(user) : (chat ? getChatTitle(lang, chat) : text);

  if (specialIcon) {
    content = (
      <Icon
        name={specialIcon}
        className={cn.icon}
        role="img"
        ariaLabel={author}
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
  } else if (isCustomPeer) {
    const title = peer.title || lang(peer.titleKey!);
    content = title && getFirstLetters(title, 1);
  } else if (text) {
    content = getFirstLetters(text, 2);
  }

  const isRoundedRect = (isCustomPeer && peer.isAvatarSquare)
  || (isForum && !((withStory || withStorySolid) && realPeer?.hasStories));
  const isPremiumGradient = isCustomPeer && peer.withPremiumGradient;
  const customColor = isCustomPeer && peer.customPeerAvatarColor;

  const fullClassName = buildClassName(
    'Avatar',
    className,
    getPeerColorClass(peer),
    !peer && text && 'hidden-user',
    isSavedMessages && 'saved-messages',
    isAnonymousForwards && 'anonymous-forwards',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isPremiumGradient && 'premium-gradient-bg',
    isRoundedRect && 'forum',
    (photo || webPhoto) && 'force-fit',
    ((withStory && realPeer?.hasStories) || forPremiumPromo) && 'with-story-circle',
    withStorySolid && realPeer?.hasStories && 'with-story-solid',
    withStorySolid && forceFriendStorySolid && 'close-friend',
    withStorySolid && (realPeer?.hasUnreadStories || forceUnreadStorySolid) && 'has-unread-story',
    onClick && 'interactive',
    (!isSavedMessages && !imgBlobUrl) && 'no-photo',
  );

  const hasMedia = Boolean(isSavedMessages || imgBlobUrl);

  const { handleClick, handleMouseDown } = useFastClick((e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (withStory && storyViewerMode !== 'disabled' && realPeer?.hasStories) {
      e.stopPropagation();

      openStoryViewer({
        peerId: realPeer.id,
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
      id={realPeer?.id && withStory ? getPeerStoryHtmlId(realPeer.id) : undefined}
      data-peer-id={realPeer?.id}
      data-test-sender-id={IS_TEST ? realPeer?.id : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
      style={buildStyle(`--_size: ${pxSize}px;`, customColor && `--color-user: ${customColor}`)}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <div className="inner">
        {typeof content === 'string' ? renderText(content, [isBig ? 'hq_emoji' : 'emoji']) : content}
      </div>
      {withStory && realPeer?.hasStories && (
        <AvatarStoryCircle peerId={realPeer.id} size={pxSize} withExtraGap={withStoryGap} />
      )}
    </div>
  );
};

export default memo(Avatar);
