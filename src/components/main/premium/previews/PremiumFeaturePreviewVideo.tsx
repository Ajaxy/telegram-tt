import type { FC } from '../../../../lib/teact/teact';
import { memo } from '../../../../lib/teact/teact';

import type { ApiThumbnail } from '../../../../api/types';

import buildClassName from '../../../../util/buildClassName';

import useCanvasBlur from '../../../../hooks/useCanvasBlur';
import useMedia from '../../../../hooks/useMedia';
import useMediaTransitionDeprecated from '../../../../hooks/useMediaTransitionDeprecated';

import OptimizedVideo from '../../../ui/OptimizedVideo';

import styles from './PremiumFeaturePreviewVideo.module.scss';

import DeviceFrame from '../../../../assets/premium/DeviceFrame.svg';

type OwnProps = {
  videoId?: string;
  videoThumbnail?: ApiThumbnail;
  isActive?: boolean;
  isReverseAnimation?: boolean;
  isDown?: boolean;
  index?: number;
  className?: string;
  wrapperClassName?: string;
};

const PremiumFeaturePreviewVideo: FC<OwnProps> = ({
  videoId,
  videoThumbnail,
  isActive,
  isReverseAnimation,
  isDown,
  index,
  className,
  wrapperClassName,
}) => {
  const mediaData = useMedia(videoId ? `document${videoId}` : undefined);
  const thumbnailRef = useCanvasBlur(videoThumbnail?.dataUri);
  const transitionClassNames = useMediaTransitionDeprecated(mediaData);

  return (
    <div className={buildClassName(styles.root, className)}>
      <div
        className={buildClassName(
          styles.wrapper,
          isReverseAnimation && styles.reverse,
          isDown && styles.down,
          wrapperClassName,
        )}
        id={index !== undefined ? `premium_feature_preview_video_${index}` : undefined}
      >
        <img src={DeviceFrame} alt="" className={styles.frame} draggable={false} />
        {!videoId && <div className={styles.placeholder} />}
        {videoThumbnail && <canvas ref={thumbnailRef} className={styles.video} />}
        {videoId && (
          <OptimizedVideo
            canPlay={Boolean(isActive)}
            className={buildClassName(styles.video, transitionClassNames)}
            src={mediaData}
            disablePictureInPicture
            playsInline
            muted
            loop
          />
        )}
      </div>
    </div>
  );
};

export default memo(PremiumFeaturePreviewVideo);
