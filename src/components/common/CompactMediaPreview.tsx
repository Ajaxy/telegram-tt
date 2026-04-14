import type React from '../../lib/teact/teact';
import { memo, useRef } from '../../lib/teact/teact';

import type {
  ApiAttachment,
  ApiDocument,
  ApiPhoto,
  ApiVideo,
  MediaContent,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { IconName } from '../../types/icons';

import {
  getDocumentMediaHash,
  getMediaThumbUri,
  getPhotoMediaHash,
  getVideoMediaHash,
} from '../../global/helpers';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../util/browser/windowEnvironment';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useAppLayout from '../../hooks/useAppLayout';
import useCanvasBlur from '../../hooks/useCanvasBlur';
import { useIsIntersecting } from '../../hooks/useIntersectionObserver';
import useMedia from '../../hooks/useMedia';
import useMediaTransition from '../../hooks/useMediaTransition';

import OptimizedVideo from '../ui/OptimizedVideo';
import Icon from './icons/Icon';
import MediaSpoiler from './MediaSpoiler';

import styles from './CompactMediaPreview.module.scss';

const PICTOGRAM_SIZE = 2 * REM;

type OwnProps = {
  id?: string;
  className?: string;
  media?: MediaContent;
  attachment?: ApiAttachment;
  size?: number;
  isPictogram?: boolean;
  isRound?: boolean;
  isProtected?: boolean;
  isSpoiler?: boolean;
  actionIcon?: IconName;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
};

export function canRenderCompactMediaPreview(
  media?: MediaContent,
  attachment?: ApiAttachment,
) {
  const photo = media?.photo;
  const document = media?.document;
  const previewUrl = getPreviewUrl(photo, document, media?.video, attachment);
  const video = media?.video || attachment?.gif;
  const shouldRenderPreviewAsVideo = shouldUseVideoPreview(video, previewUrl);
  const previewVideoUrl = shouldRenderPreviewAsVideo
    ? (media?.video?.blobUrl || attachment?.blobUrl)
    : undefined;
  const previewHash = getPreviewHash(photo, document, video, shouldRenderPreviewAsVideo);

  return Boolean(
    previewUrl
    || previewVideoUrl
    || previewHash
    || getThumbDataUri(photo, document, media?.video, attachment),
  );
}

const CompactMediaPreview = ({
  id,
  className,
  media,
  attachment,
  size,
  isPictogram,
  isRound,
  isProtected,
  isSpoiler,
  actionIcon,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();
  const { isMobile } = useAppLayout();

  const previewSize = size || (isPictogram ? PICTOGRAM_SIZE : undefined);
  const photo = media?.photo;
  const document = media?.document;
  const video = media?.video || attachment?.gif;
  const previewUrl = getPreviewUrl(photo, document, media?.video, attachment);
  const shouldRenderPreviewAsVideo = shouldUseVideoPreview(video, previewUrl);

  const isIntersectingForLoading = useIsIntersecting(ref, observeIntersectionForLoading);
  const isIntersectingForPlaying = (
    useIsIntersecting(ref, observeIntersectionForPlaying)
    && isIntersectingForLoading
  );

  const previewHash = getPreviewHash(photo, document, video, shouldRenderPreviewAsVideo);

  const previewVideoUrl = shouldRenderPreviewAsVideo
    ? (media?.video?.blobUrl || attachment?.blobUrl)
    : undefined;
  const thumbDataUri = getThumbDataUri(photo, document, media?.video, attachment);

  const fetchedPreviewUrl = useMedia(
    previewHash,
    Boolean(!previewHash || previewUrl || previewVideoUrl || !isIntersectingForLoading),
  );

  const resolvedPreviewUrl = previewUrl || (!shouldRenderPreviewAsVideo ? fetchedPreviewUrl : undefined);
  const resolvedPreviewVideoUrl = previewVideoUrl || (shouldRenderPreviewAsVideo ? fetchedPreviewUrl : undefined);
  const shouldShowSpoiler = isSpoiler ?? photo?.isSpoiler ?? media?.video?.isSpoiler ?? attachment?.shouldSendAsSpoiler;

  const hasResolvedMedia = Boolean(resolvedPreviewUrl || resolvedPreviewVideoUrl);
  const shouldShowCanvasThumb = Boolean(thumbDataUri && (shouldShowSpoiler || !hasResolvedMedia));
  const canvasRef = useCanvasBlur(
    thumbDataUri,
    !thumbDataUri || !shouldShowCanvasThumb,
    isMobile && !IS_CANVAS_FILTER_SUPPORTED,
    undefined,
    previewSize,
    previewSize,
  );
  useMediaTransition({
    ref: canvasRef,
    hasMediaData: shouldShowCanvasThumb,
  });

  const { ref: imageRef } = useMediaTransition<HTMLImageElement>({
    hasMediaData: Boolean(resolvedPreviewUrl && !shouldShowSpoiler),
  });
  const { ref: videoRef } = useMediaTransition<HTMLVideoElement>({
    hasMediaData: Boolean(resolvedPreviewVideoUrl && !shouldShowSpoiler),
  });

  const spoilerThumbDataUri = thumbDataUri || resolvedPreviewUrl;
  const style = previewSize ? `width: ${previewSize}px; height: ${previewSize}px` : undefined;

  return (
    <div
      ref={ref}
      id={id}
      className={buildClassName(
        styles.root,
        className,
        isPictogram && styles.pictogram,
        isRound && styles.round,
        actionIcon && styles.withActionIcon,
        onClick && styles.interactive,
      )}
      style={style}
      onClick={onClick}
    >
      {thumbDataUri && (
        <canvas
          ref={canvasRef}
          className={buildClassName('thumbnail', styles.thumb)}
        />
      )}
      {!shouldShowSpoiler && resolvedPreviewUrl && (
        <img
          ref={imageRef}
          src={resolvedPreviewUrl}
          alt=""
          className={buildClassName('full-media', styles.media)}
          draggable={false}
        />
      )}
      {!shouldShowSpoiler && resolvedPreviewVideoUrl && (
        <OptimizedVideo
          ref={videoRef}
          className={buildClassName('full-media', styles.media)}
          src={resolvedPreviewVideoUrl}
          canPlay={isIntersectingForPlaying}
          poster={thumbDataUri}
          loop
          playsInline
          muted
          disablePictureInPicture
        />
      )}
      <MediaSpoiler
        thumbDataUri={spoilerThumbDataUri}
        isVisible={Boolean(shouldShowSpoiler)}
        width={previewSize}
        height={previewSize}
      />
      {isProtected && <span className={buildClassName('protector', styles.protector)} />}
      {actionIcon && <Icon name={actionIcon} className={styles.actionIcon} />}
    </div>
  );
};

function getThumbDataUri(
  photo?: ApiPhoto,
  document?: ApiDocument,
  video?: ApiVideo,
  attachment?: ApiAttachment,
) {
  return (photo && getMediaThumbUri(photo))
    || (document && getMediaThumbUri(document))
    || (video && getMediaThumbUri(video))
    || attachment?.previewBlobUrl
    || (attachment?.mimeType.startsWith('image/') ? attachment.blobUrl : undefined);
}

function getPreviewUrl(
  photo?: ApiPhoto,
  document?: ApiDocument,
  video?: ApiVideo,
  attachment?: ApiAttachment,
) {
  return photo?.blobUrl
    || document?.previewBlobUrl
    || video?.previewBlobUrl
    || attachment?.previewBlobUrl
    || (attachment?.mimeType.startsWith('image/') ? attachment.blobUrl : undefined);
}

function shouldUseVideoPreview(video: ApiVideo | undefined, previewUrl?: string) {
  return Boolean(video?.isGif && !video.previewPhotoSizes?.length && !previewUrl);
}

function getPreviewHash(
  photo?: ApiPhoto,
  document?: ApiDocument,
  video?: ApiVideo,
  shouldRenderPreviewAsVideo?: boolean,
) {
  if (photo) {
    return getPhotoMediaHash(photo, 'pictogram');
  }

  if (document) {
    return getDocumentMediaHash(document, 'pictogram');
  }

  if (video) {
    return getVideoMediaHash(video, shouldRenderPreviewAsVideo ? 'full' : 'pictogram');
  }

  return undefined;
}

export default memo(CompactMediaPreview);
