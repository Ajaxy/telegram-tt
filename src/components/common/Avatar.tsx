import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import {
  memo, useMemo, useRef, useState,
} from '../../lib/teact/teact';
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
  getPeerColorKey,
  getPeerStoryHtmlId,
  getUserFullName,
  getVideoProfilePhotoMediaHash,
  getVideoProfilePhotoStartTs,
  getWebDocumentHash,
  isAnonymousForwardsChat,
  isChatCommunity,
  isChatWithRepliesBot,
  isDeletedUser,
} from '../../global/helpers';
import { isApiPeerChat, isApiPeerUser } from '../../global/helpers/peers';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { isUserId } from '../../util/entities/ids';
import { getFirstLetters } from '../../util/text/textFormat';
import { REM } from './helpers/mediaDimensions';
import renderText from './helpers/renderText';

import { useFastClick } from '../../hooks/useFastClick';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';
import { getPeerColorClass } from '../../hooks/usePeerColor';

import OptimizedVideo from '../ui/OptimizedVideo';
import AvatarStoryCircle from './AvatarStoryCircle';
import Icon from './icons/Icon';

import './Avatar.scss';
import styles from './Avatar.module.scss';

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

type LoadedImage = {
  peerId?: string;
  url: string;
  replacedUrl?: string;
};

type OwnProps = {
  containerRef?: ElementRef<HTMLDivElement>;
  className?: string;
  style?: string;
  size?: AvatarSize;
  peer?: ApiPeer | CustomPeer;
  photo?: ApiPhoto;
  webPhoto?: ApiWebDocument;
  previewUrl?: string;
  text?: string;
  isSavedMessages?: boolean;
  isSavedDialog?: boolean;
  withVideo?: boolean;
  withStory?: boolean;
  forPremiumPromo?: boolean;
  withStoryGap?: boolean;
  storyGapPercent?: number;
  withStorySolid?: boolean;
  storyColors?: string[];
  forceFriendStorySolid?: boolean;
  forceUnreadStorySolid?: boolean;
  storyViewerOrigin?: StoryViewerOrigin;
  storyViewerMode?: 'full' | 'single-peer' | 'disabled';
  loopIndefinitely?: boolean;
  noPersonalPhoto?: boolean;
  forceRound?: boolean;
  asMessageBubble?: boolean;
  storyCircleStyle?: string;
  observeIntersection?: ObserveFn;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>, hasMedia: boolean) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onLoad?: NoneToVoidFunction;
};

const Avatar = ({
  containerRef,
  className,
  style,
  size = 'large',
  peer,
  photo,
  webPhoto,
  previewUrl,
  text,
  isSavedMessages,
  isSavedDialog,
  withVideo,
  withStory,
  forPremiumPromo,
  withStoryGap,
  storyGapPercent,
  withStorySolid,
  storyColors,
  forceFriendStorySolid,
  forceUnreadStorySolid,
  storyViewerOrigin,
  storyViewerMode = 'single-peer',
  loopIndefinitely,
  noPersonalPhoto,
  forceRound,
  asMessageBubble,
  storyCircleStyle,
  onClick,
  onContextMenu,
  onMouseMove,
  onLoad,
}: OwnProps) => {
  const { openStoryViewer } = getActions();

  const videoLoopCountRef = useRef(0);
  const loadedImageRef = useRef<LoadedImage>();
  const [fadingImgUrl, setFadingImgUrl] = useState<string | undefined>();
  const isCustomPeer = peer && 'isCustomPeer' in peer;
  const realPeer = peer && !isCustomPeer ? peer : undefined;
  const user = realPeer && isApiPeerUser(realPeer) ? realPeer : undefined;
  const chat = realPeer && isApiPeerChat(realPeer) ? realPeer : undefined;
  const isDeleted = user && isDeletedUser(user);
  const isReplies = realPeer && isChatWithRepliesBot(realPeer.id);
  const isAnonymousForwards = realPeer && isAnonymousForwardsChat(realPeer.id);
  const isForum = chat?.isForum;
  const isCommunity = Boolean(chat && isChatCommunity(chat));

  const peerColorKey = getPeerColorKey(peer, true);
  const peerColorClass = peerColorKey !== undefined ? getPeerColorClass(peerColorKey) : undefined;

  const isStoryClickable = withStory && storyViewerMode !== 'disabled' && realPeer?.hasStories;

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
    } else if (webPhoto) {
      imageHash = getWebDocumentHash(webPhoto);
    }

    if (withVideo && photo?.isVideo) {
      videoHash = getVideoProfilePhotoMediaHash(photo);
    }
  }

  const specialIcon = useMemo(() => {
    if (isCustomPeer) {
      return peer.avatarIcon;
    }

    if (isSavedMessages) {
      return isSavedDialog ? 'my-notes' : 'saved-messages-filled';
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

  const peerId = realPeer?.id;
  if (!imageHash) {
    loadedImageRef.current = undefined;
  } else if (imgBlobUrl && imgBlobUrl !== loadedImageRef.current?.url) {
    const prevImage = loadedImageRef.current;
    loadedImageRef.current = {
      peerId,
      url: imgBlobUrl,
      replacedUrl: peerId && prevImage?.peerId === peerId ? prevImage.url : undefined,
    };
  }
  const peerImage = peerId && loadedImageRef.current?.peerId === peerId ? loadedImageRef.current : undefined;
  const imgUrl = imgBlobUrl || previewUrl || peerImage?.url;
  const replacedImgUrl = imgBlobUrl && peerImage?.replacedUrl;
  const hasBlobUrl = Boolean(imgUrl || videoBlobUrl);
  // `videoBlobUrl` can be taken from memory cache, so we need to check `shouldLoadVideo` again
  const shouldPlayVideo = Boolean(videoBlobUrl && shouldLoadVideo);

  const { ref: mediaRef } = useMediaTransition<HTMLImageElement>({ hasMediaData: hasBlobUrl });

  const handleImgLoad = useLastCallback(() => {
    if (replacedImgUrl) setFadingImgUrl(replacedImgUrl);
    onLoad?.();
  });

  const handleVideoLoadedMetadata = useLastCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const startTs = photo && getVideoProfilePhotoStartTs(photo);
    if (startTs) e.currentTarget.currentTime = startTs;
  });

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
  const author = user ? getUserFullName(lang, user) : (chat ? getChatTitle(lang, chat) : text);

  if (specialIcon) {
    content = (
      <Icon
        name={specialIcon}
        className={styles.icon}
        role="img"
        ariaLabel={author}
      />
    );
  } else if (hasBlobUrl) {
    content = (
      <>
        <img
          ref={mediaRef}
          src={imgUrl}
          className={buildClassName(styles.media, 'avatar-media', videoBlobUrl && 'poster')}
          alt={author}
          decoding="async"
          draggable={false}
          onLoad={handleImgLoad}
        />
        {shouldPlayVideo && (
          <OptimizedVideo
            canPlay
            src={videoBlobUrl}
            className={buildClassName(styles.media, 'avatar-media', 'poster')}
            muted
            loop={loopIndefinitely}
            autoPlay
            disablePictureInPicture
            playsInline
            draggable={false}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onEnded={handleVideoEnded}
          />
        )}
        {replacedImgUrl && (
          <img
            key={replacedImgUrl}
            src={replacedImgUrl}
            className={buildClassName(
              styles.media, 'avatar-media', styles.replaced, replacedImgUrl === fadingImgUrl && styles.fadeOut,
            )}
            alt=""
            draggable={false}
          />
        )}
      </>
    );
  } else if (user) {
    const userFullName = getUserFullName(lang, user);
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
    || isCommunity
    || (isForum && !forceRound && !((withStory || withStorySolid) && realPeer?.hasStories));
  const isPremiumGradient = isCustomPeer && peer.withPremiumGradient;
  const customColor = isCustomPeer && peer.customPeerAvatarColor;

  const fullClassName = buildClassName(
    'Avatar',
    className,
    typeof size === 'string' && `size-${size}`,
    peerColorClass,
    !peer && text && 'hidden-user',
    isSavedMessages && 'saved-messages',
    isAnonymousForwards && 'anonymous-forwards',
    isDeleted && 'deleted-account',
    isReplies && 'replies-bot-account',
    isPremiumGradient && 'premium-gradient-bg',
    isRoundedRect && 'forum',
    isCommunity && 'community',
    asMessageBubble && 'message-bubble',
    (photo || webPhoto) && styles.forceFit,
    ((withStory && realPeer?.hasStories) || forPremiumPromo) && 'with-story-circle',
    withStorySolid && realPeer?.hasStories && 'with-story-solid',
    withStorySolid && forceFriendStorySolid && 'close-friend',
    withStorySolid && (realPeer?.hasUnreadStories || forceUnreadStorySolid) && 'has-unread-story',
    (onClick || isStoryClickable) && 'interactive',
    (!isSavedMessages && !imgUrl) && 'no-photo',
  );

  const fullStyle = buildStyle(
    `--_size: ${pxSize}px;`,
    customColor && `--color-user: ${customColor}`,
    style,
  );

  const hasMedia = Boolean(isSavedMessages || imgUrl);

  const { handleClick, handleMouseDown } = useFastClick((e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (isStoryClickable) {
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
      ref={containerRef}
      className={fullClassName}
      id={realPeer?.id && withStory ? getPeerStoryHtmlId(realPeer.id) : undefined}
      data-peer-id={realPeer?.id}
      data-test-sender-id={IS_TEST ? realPeer?.id : undefined}
      aria-label={typeof content === 'string' ? author : undefined}
      style={fullStyle}
      onClick={handleClick}
      onContextMenu={onContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={onMouseMove}
    >
      <div className="inner">
        {typeof content === 'string'
          ? <span className="letters">{renderText(content, [isBig ? 'hq_emoji' : 'emoji'])}</span>
          : content}
      </div>
      {withStory && realPeer?.hasStories && (
        <AvatarStoryCircle
          peerId={realPeer.id}
          size={pxSize}
          withExtraGap={withStoryGap}
          extraGapPercent={storyGapPercent}
          colors={storyColors}
          style={storyCircleStyle}
        />
      )}
    </div>
  );
};

export default memo(Avatar);
