import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMediaArea, ApiStory } from '../../../api/types';

import { MOBILE_SCREEN_MAX_WIDTH } from '../../../config';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions';

import useWindowSize from '../../../hooks/useWindowSize';

import MediaAreaSuggestedReaction from './MediaAreaSuggestedReaction';

import styles from './MediaArea.module.scss';

type OwnProps = {
  story: ApiStory;
  isActive?: boolean;
  className?: string;
};

const STORY_ASPECT_RATIO = 9 / 16;
const MOBILE_MEDIA_BOTTOM_MARGIN = 4 * REM;

const MediaAreaOverlay = ({
  story, isActive, className,
}: OwnProps) => {
  const { openMapModal } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const windowSize = useWindowSize();

  useEffect(() => {
    if (!ref.current || !isActive) return;
    const element = ref.current;

    if (windowSize.width > MOBILE_SCREEN_MAX_WIDTH) {
      requestMutation(() => {
        element.style.removeProperty('--media-width');
      });
      return;
    }

    const adaptedHeight = windowSize.height - MOBILE_MEDIA_BOTTOM_MARGIN;

    const screenAspectRatio = windowSize.width / adaptedHeight;

    const width = screenAspectRatio > STORY_ASPECT_RATIO ? adaptedHeight * STORY_ASPECT_RATIO : windowSize.width;
    requestMutation(() => {
      element.style.setProperty('--media-width', `${width}px`);
    });
  }, [isActive, windowSize]);

  const handleMediaAreaClick = (mediaArea: ApiMediaArea) => {
    if (mediaArea.type === 'geoPoint' || mediaArea.type === 'venue') {
      openMapModal({ geoPoint: mediaArea.geo });
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
            return (
              <div
                className={buildClassName(styles.mediaArea, isActive && styles.shiny)}
                style={prepareStyle(mediaArea)}
                onClick={() => handleMediaAreaClick(mediaArea)}
              />
            );
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
