import React, {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMediaArea, ApiStory } from '../../../api/types';

import { MOBILE_SCREEN_MAX_WIDTH } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import useWindowSize from '../../../hooks/window/useWindowSize';

import MediaAreaSuggestedReaction from './MediaAreaSuggestedReaction';
import MediaAreaWeather from './MediaAreaWeather';

import styles from './MediaArea.module.scss';

type OwnProps = {
  story: ApiStory;
  isActive?: boolean;
  isStoryPlaying?: boolean;
  className?: string;
};

const STORY_ASPECT_RATIO = 9 / 16;
const PERCENTAGE_BASE = 100;

const NO_SHINY_TYPES = new Set<ApiMediaArea['type']>(['channelPost', 'uniqueGift']);

const MediaAreaOverlay = ({
  story, isActive, className, isStoryPlaying,
}: OwnProps) => {
  const {
    openMapModal, openUniqueGiftBySlug, focusMessage, closeStoryViewer, openUrl,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const [mediaWidth, setMediaWidth] = useState(0);

  const windowSize = useWindowSize();

  useEffect(() => {
    if (!ref.current) return;
    const element = ref.current;
    setMediaWidth(element!.clientWidth!);

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
      case 'url': {
        openUrl({ url: mediaArea.url });
        break;
      }
      case 'uniqueGift': {
        openUniqueGiftBySlug({ slug: mediaArea.slug });
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
          case 'channelPost':
          case 'url':
          case 'uniqueGift': {
            const isShiny = isActive && !NO_SHINY_TYPES.has(mediaArea.type);
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
          case 'weather': {
            return (
              <MediaAreaWeather
                // eslint-disable-next-line react/no-array-index-key
                key={`${mediaArea.type}-${i}`}
                mediaArea={mediaArea}
                className={styles.mediaArea}
                style={prepareStyle(mediaArea, mediaWidth)}
                isPreview={!isActive || isStoryPlaying}
              />
            );
          }
          default:
            return undefined;
        }
      })}
    </div>
  );
};

function prepareStyle(mediaArea: ApiMediaArea, mediaWidth?: number) {
  const {
    x, y, width, height, rotation, radius,
  } = mediaArea.coordinates;

  let pixelRadius = '';

  if (mediaWidth && radius && mediaWidth > 0) {
    const pixelWidth = (mediaWidth * (width / PERCENTAGE_BASE));
    const pixelHeight = (mediaWidth * (height / PERCENTAGE_BASE));
    pixelRadius = `${Math.min(pixelWidth, pixelHeight) * (radius / PERCENTAGE_BASE)}px`;
  }

  return buildStyle(
    `left: ${x}%`,
    `top: ${y}%`,
    `width: ${width}%`,
    `height: ${height}%`,
    `transform: rotate(${rotation}deg) translate(-50%, -50%)`,
    pixelRadius && `border-radius: ${pixelRadius}`,
  );
}

export default memo(MediaAreaOverlay);
