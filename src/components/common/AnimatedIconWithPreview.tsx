import React, { memo } from '../../lib/teact/teact';

import type { OwnProps as AnimatedIconProps } from './AnimatedIcon';

import buildClassName from '../../util/buildClassName';

import useMediaTransition from '../../hooks/useMediaTransition';
import AnimatedIcon from './AnimatedIcon';
import styles from './AnimatedIconWithPreview.module.scss';
import useFlag from '../../hooks/useFlag';
import buildStyle from '../../util/buildStyle';

type OwnProps =
  Partial<AnimatedIconProps>
  & { previewUrl?: string; thumbDataUri?: string };

function AnimatedIconWithPreview(props: OwnProps) {
  const {
    previewUrl, thumbDataUri, className, ...otherProps
  } = props;

  const transitionClassNames = useMediaTransition(previewUrl);
  const [isAnimationReady, markAnimationReady] = useFlag(false);
  const { size } = props;

  return (
    <div
      className={buildClassName(className, styles.root)}
      style={buildStyle(size !== undefined && `width: ${size}px; height: ${size}px;`)}
    >
      {!isAnimationReady && thumbDataUri && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={thumbDataUri} className={buildClassName(styles.preview)} />
      )}
      {!isAnimationReady && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img src={previewUrl} className={buildClassName(styles.preview, transitionClassNames)} />
      )}
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <AnimatedIcon {...otherProps} onLoad={markAnimationReady} noTransition />
    </div>
  );
}

export default memo(AnimatedIconWithPreview);
