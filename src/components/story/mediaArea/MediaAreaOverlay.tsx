import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMediaArea, ApiStory } from '../../../api/types';

import { MOBILE_SCREEN_MAX_WIDTH } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import useWindowSize from '../../../hooks/useWindowSize';

import MediaAreaSuggestedReaction from './MediaAreaSuggestedReaction';

import styles from './MediaArea.module.scss';

type OwnProps = {
  story: ApiStory;
  isActive?: boolean;
  className?: string;
};

const STORY_ASPECT_RATIO = 9 / 16;

const MediaAreaOverlay = ({
  story, isActive, className,
}: OwnProps) => {
  const { openMapModal, focusMessage, closeStoryViewer } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const windowSize = useWindowSize();

  useEffect(() => {
    if (!ref.current || !isActive) return;
    const element = ref.current;

    if (windowSize.width > MOBILE_SCREEN_MAX_WIDTH) {
      requestMutation(() => {
        element.style.removeProperty('--media-width');
        element.style.removeProperty('--media-height');
      });
      return;
    }

    const screenAspectRatio = windowSize.width / windowSize.height;

    const width = screenAspectRatio < STORY_ASPECT_RATIO
      ? element.clientHeight * STORY_ASPECT_RATIO : element.clientWidth;
    const height = screenAspectRatio < STORY_ASPECT_RATIO
      ? element.clientHeight : element.clientWidth / STORY_ASPECT_RATIO;

    requestMutation(() => {
      element.style.setProperty('--media-width', `${width}px`);
      element.style.setProperty('--media-height', `${height}px`);
    });
  }, [isActive, windowSize]);

  const handleMediaAreaClick = (mediaArea: ApiMediaArea) => {
    switch (mediaArea.type) {
      case 'geoPoint':
      case 'venue': {
        openMapModal({ geoPoint: mediaArea.geo });
        break;
      }
      case 'channelPost': {
        focusMessage({
          chatId: mediaArea.channelId,
          messageId: mediaArea.messageId,
        });
        closeStoryViewer();
        break;
      }
    }
  };

  const mediaAreas = story.mediaAreas;

  return (
    <div
      className={buildClassName(styles.overlay, !isActive && styles.preview, className)}
      ref={ref}
    >
      {mediaAreas?.map((mediaArea, i) => {
        switch (mediaArea.type) {
          case 'geoPoint':
          case 'venue':
          case 'channelPost': {
            const isShiny = isActive && (mediaArea.type === 'geoPoint' || mediaArea.type === 'venue');
            return (
              <div
                className={buildClassName(styles.mediaArea, isShiny && styles.shiny)}
                style={prepareStyle(mediaArea)}
                onClick={() => handleMediaAreaClick(mediaArea)}
              />
            );
          }
          case 'suggestedReaction':
            return (
              <MediaAreaSuggestedReaction
                // eslint-disable-next-line react/no-array-index-key
                key={`${mediaArea.type}-${i}`}
                story={story}
                mediaArea={mediaArea}
                index={i}
                isPreview={!isActive}
                className={styles.mediaArea}
                style={prepareStyle(mediaArea)}
              />
            );
          default:
            return undefined;
        }
      })}
    </div>
  );
};

function prepareStyle(mediaArea: ApiMediaArea) {
  const {
    x, y, width, height, rotation,
  } = mediaArea.coordinates;

  return buildStyle(
    `left: ${x}%`,
    `top: ${y}%`,
    `width: ${width}%`,
    `height: ${height}%`,
    `transform: rotate(${rotation}deg) translate(-50%, -50%)`,
  );
}

export default memo(MediaAreaOverlay);
