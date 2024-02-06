import type { AriaRole } from 'react';
import React from '../../lib/teact/teact';

import type { IconName } from '../../types/icons';

import buildClassName from '../../util/buildClassName';

type OwnProps = {
  name: IconName;
  className?: string;
  style?: string;
  role?: AriaRole;
  ariaLabel?: string;
};

const Icon = ({
  name,
  className,
  style,
  role,
  ariaLabel,
}: OwnProps) => {
  return (
    <i
      className={buildClassName(`icon icon-${name}`, className)}
      style={style}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={role}
    />
  );
};

export default Icon;
