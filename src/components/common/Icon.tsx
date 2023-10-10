import React from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';

type OwnProps = {
  name: IconName;
  className?: string;
  style?: string;
};

const Icon = ({
  name,
  className,
  style,
}: OwnProps) => {
  return (
    <i
      className={buildClassName(`icon icon-${name}`, className)}
      style={style}
      aria-hidden
    />
  );
};

export default Icon;
