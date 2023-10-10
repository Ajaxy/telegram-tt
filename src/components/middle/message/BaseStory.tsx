import React, { memo, useEffect } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessageStoryData, ApiTypeStory } from '../../../api/types';

import { getStoryMediaHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { formatMediaDuration } from '../../../util/dateFormat';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useCanvasBlur from '../../../hooks/useCanvasBlur';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useShowTransition from '../../../hooks/useShowTransition';

import MediaAreaOverlay from '../../story/mediaArea/MediaAreaOverlay';

import styles from './BaseStory.module.scss';

interface OwnProps {
  story?: ApiTypeStory | ApiMessageStoryData;
  isPreview?: boolean;
  isProtected?: boolean;
  isConnected?: boolean;
}

function BaseStory({
  story, isPreview, isProtected, isConnected,
}: OwnProps) {
  const { openStoryViewer, loadPeerStoriesByIds, showNotification } = getActions();

  const lang = useLang();
  const { isMobile } = useAppLayout();
  const isExpired = story && 'isDeleted' in story;
  const isLoaded = story && 'content' in story;
  const video = isLoaded ? story.content.video : undefined;
  const imageHash = isLoaded ? getStoryMediaHash(story) : undefined;
  const imgBlobUrl = useMedia(imageHash);
  const thumbnail = isLoaded ? (video ? video.thumbnail?.dataUri : story.content.photo?.thumbnail?.dataUri) : undefined;
  const mediaUrl = useCurrentOrPrev(imgBlobUrl, true);
  const { shouldRender, transitionClassNames } = useShowTransition(Boolean(mediaUrl));
  const blurredBackgroundRef = useCanvasBlur(
    thumbnail,
    isExpired && !isPreview,
    isMobile && !IS_CANVAS_FILTER_SUPPORTED,
  );

  const fullClassName = buildClassName(
    styles.root,
    'media-inner',
    (!isConnected || isExpired) && styles.nonInteractive,
    isExpired && styles.expired,
    isPreview && styles.preview,
  );

  useEffect(() => {
    if (story && !(isLoaded || isExpired)) {
      loadPeerStoriesByIds({ peerId: story.peerId, storyIds: [story.id] });
    }
  }, [story, isExpired, isLoaded]);

  const handleClick = useLastCallback(() => {
    if (isExpired) {
      showNotification({
        message: lang('StoryNotFound'),
      });
      return;
    }

    openStoryViewer({
      peerId: story!.peerId,
      storyId: story!.id,
      isSinglePeer: true,
      isSingleStory: true,
    });
  });

  return (
    <div
      className={fullClassName}
      onClick={isConnected ? handleClick : undefined}
    >
      {!isExpired && isPreview && <canvas ref={blurredBackgroundRef} className="thumbnail blurred-bg" />}
      {shouldRender && (
        <>
          <img
            src={mediaUrl}
            alt=""
            className={buildClassName(styles.media, isPreview && styles.linkPreview, transitionClassNames)}
            draggable={false}
          />
          {isLoaded && <MediaAreaOverlay story={story} className={transitionClassNames} />}
        </>
      )}
      {isExpired && (
        <span>
          <i className={buildClassName(styles.expiredIcon, 'icon icon-story-expired')} aria-hidden />
          {lang('StoryExpiredSubtitle')}
        </span>
      )}
      {Boolean(video?.duration) && (
        <div className="message-media-duration">
          {formatMediaDuration(video!.duration)}
        </div>
      )}
      {isProtected && <span className="protector" />}
    </div>
  );
}

export default memo(BaseStory);
