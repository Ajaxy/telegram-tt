import React, { memo } from '../../lib/teact/teact';

import type { OwnProps as AnimatedIconProps } from './AnimatedIcon';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useFlag from '../../hooks/useFlag';
import useLastCallback from '../../hooks/useLastCallback';
import useMediaTransitionDeprecated from '../../hooks/useMediaTransitionDeprecated';

import AnimatedIcon from './AnimatedIcon';

import styles from './AnimatedIconWithPreview.module.scss';

type OwnProps =
  Partial<AnimatedIconProps>
  & { previewUrl?: string; thumbDataUri?: string; noPreviewTransition?: boolean };

const ANIMATION_DURATION = 300;

const loadedPreviewUrls = new Set();

function AnimatedIconWithPreview(props: OwnProps) {
  const {
    previewUrl, thumbDataUri, className, ...otherProps
  } = props;

  const [isThumbOpen, , unmarkThumbOpen] = useFlag(Boolean(thumbDataUri));
  const thumbClassNames = useMediaTransitionDeprecated(isThumbOpen);

  const [isPreviewOpen, markPreviewOpen, unmarkPreviewOpen] = useFlag(loadedPreviewUrls.has(previewUrl));
  const previewClassNames = useMediaTransitionDeprecated(isPreviewOpen);

  const [isAnimationReady, markAnimationReady] = useFlag(false);

  const handlePreviewLoad = useLastCallback(() => {
    markPreviewOpen();
    loadedPreviewUrls.add(previewUrl);
  });

  const handleAnimationReady = useLastCallback(() => {
    unmarkThumbOpen();
    unmarkPreviewOpen();
    setTimeout(markAnimationReady, ANIMATION_DURATION);
  });

  const { size } = props;

  return (
    <div
      className={buildClassName(className, styles.root)}
      style={buildStyle(size !== undefined && `width: ${size}px; height: ${size}px;`)}
    >
      {thumbDataUri && !isAnimationReady && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={thumbDataUri} className={buildClassName(styles.preview, thumbClassNames)} draggable={false} />
      )}
      {previewUrl && !isAnimationReady && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img
          src={previewUrl}
          className={buildClassName(styles.preview, previewClassNames)}
          draggable={false}
          onLoad={handlePreviewLoad}
        />
      )}
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <AnimatedIcon {...otherProps} onLoad={handleAnimationReady} />
    </div>
  );
}

export default memo(AnimatedIconWithPreview);
