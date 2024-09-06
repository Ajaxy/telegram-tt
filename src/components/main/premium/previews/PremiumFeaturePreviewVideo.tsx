import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiThumbnail } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';

import useCanvasBlur from '../../../../hooks/useCanvasBlur';
import useMedia from '../../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../../hooks/useMediaTransitionDeprecated';

import OptimizedVideo from '../../../ui/OptimizedVideo';

import styles from './PremiumFeaturePreviewVideo.module.scss';

import DeviceFrame from '../../../../assets/premium/DeviceFrame.svg';

type OwnProps = {
  videoId: string;
  isReverseAnimation: boolean;
  isDown: boolean;
  videoThumbnail: ApiThumbnail;
  index: number;
  isActive: boolean;
};

const PremiumFeaturePreviewVideo: FC<OwnProps> = ({
  videoId,
  isReverseAnimation,
  isDown,
  videoThumbnail,
  index,
  isActive,
}) => {
  const mediaData = useMedia(`document${videoId}`);
  const thumbnailRef = useCanvasBlur(videoThumbnail.dataUri);
  const transitionClassNames = useMediaTransitionDeprecated(mediaData);

  return (
    <div className={styles.root}>
      <div
        className={buildClassName(
          styles.wrapper,
          isReverseAnimation && styles.reverse,
          isDown && styles.down,
        )}
        id={`premium_feature_preview_video_${index}`}
      >
        <img src={DeviceFrame} alt="" className={styles.frame} draggable={false} />
        <canvas ref={thumbnailRef} className={styles.video} />
        <OptimizedVideo
          canPlay={isActive}
          className={buildClassName(styles.video, transitionClassNames)}
          src={mediaData}
          disablePictureInPicture
          playsInline
          muted
          loop
        />
      </div>
    </div>
  );
};

export default memo(PremiumFeaturePreviewVideo);
