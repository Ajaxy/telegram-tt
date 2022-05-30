import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import type { ANIMATED_STICKERS_PATHS } from './helpers/animatedAssets';
import getAnimationData from './helpers/animatedAssets';

import AnimatedSticker from './AnimatedSticker';

type OwnProps = {
  name: keyof typeof ANIMATED_STICKERS_PATHS;
  size: number;
  playSegment?: [number, number];
  color?: [number, number, number];
};

const AnimatedIcon: FC<OwnProps> = ({
  size,
  name,
  playSegment,
  color,
}) => {
  const [iconData, setIconData] = useState<string>();

  useEffect(() => {
    getAnimationData(name).then(setIconData);
  }, [name]);

  return (
    <AnimatedSticker
      id={name}
      play
      noLoop
      playSegment={playSegment}
      size={size}
      speed={1}
      animationData={iconData}
      color={color}
    />
  );
};

export default memo(AnimatedIcon);
