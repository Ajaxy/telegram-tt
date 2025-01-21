import type { AriaRole } from 'react';
import React from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import buildClassName from '../../../util/buildClassName';

type OwnProps = {
  name: IconName;
  className?: string;
  style?: string;
  role?: AriaRole;
  ariaLabel?: string;
  character?: string;
  ref?: React.RefObject<HTMLElement>;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const Icon = ({
  name,
  ref,
  className,
  style,
  role,
  ariaLabel,
  character,
  onClick,
}: OwnProps) => {
  return (
    <i
      ref={ref}
      className={buildClassName(`icon icon-${name}`, className)}
      style={style}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      data-char={character}
      role={role}
      onClick={onClick}
    />
  );
};

export default Icon;
