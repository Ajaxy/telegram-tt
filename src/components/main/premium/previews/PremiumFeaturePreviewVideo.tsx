import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../../lib/teact/teact';

import type { ApiThumbnail } from '../../../../api/types';

import useMedia from '../../../../hooks/useMedia';
import buildClassName from '../../../../util/buildClassName';
import useCanvasBlur from '../../../../hooks/useCanvasBlur';
import useMediaTransition from '../../../../hooks/useMediaTransition';
import safePlay from '../../../../util/safePlay';

import DeviceFrame from '../../../../assets/premium/DeviceFrame.svg';

import styles from './PremiumFeaturePreviewVideo.module.scss';

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
  const transitionClassNames = useMediaTransition(mediaData);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      safePlay(video);
    } else {
      video.pause();
    }
  }, [isActive]);

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
        <img src={DeviceFrame} alt="" className={styles.frame} />
        <canvas ref={thumbnailRef} className={styles.video} />
        <video
          ref={videoRef}
          className={buildClassName(
            styles.video,
            transitionClassNames,
          )}
          src={mediaData}
          autoPlay={isActive}
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
