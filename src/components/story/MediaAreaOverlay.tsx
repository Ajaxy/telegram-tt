import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiMediaArea } from '../../api/types';
import type { IDimensions } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import styles from './StoryViewer.module.scss';

type OwnProps = {
  mediaAreas?: ApiMediaArea[];
  mediaDimensions: IDimensions;
};

const MediaAreaOverlay = ({ mediaAreas, mediaDimensions }: OwnProps) => {
  const { openMapModal } = getActions();
  const handleMediaAreaClick = (mediaArea: ApiMediaArea) => {
    if (mediaArea.geo) {
      openMapModal({ geoPoint: mediaArea.geo });
    }
  };

  return (
    <div
      className={buildClassName(styles.mediaAreaOverlay, styles.media)}
      style={buildStyle(`aspect-ratio: ${mediaDimensions.width} / ${mediaDimensions.height}`)}
    >
      {mediaAreas?.map((mediaArea) => (
        <div
          className={styles.mediaArea}
          style={prepareStyle(mediaArea)}
          onClick={() => handleMediaAreaClick(mediaArea)}
        />
      ))}
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
