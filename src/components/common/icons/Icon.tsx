import type { AriaRole } from 'react';
import { type ElementRef, memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import { selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';

import useSelector from '../../../hooks/data/useSelector';

import styles from './Icon.module.scss';

type OwnProps = {
  name: IconName;
  className?: string;
  style?: string;
  role?: AriaRole;
  ariaLabel?: string;
  character?: string;
  hasPremiumBadge?: boolean;
  ref?: ElementRef<HTMLElement>;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const Icon = (props: OwnProps) => {
  if (props.hasPremiumBadge) {
    return <IconWithPremiumBadge {...props} />;
  }

  return renderIcon(props);
};

const IconWithPremiumBadge = memo((props: OwnProps) => {
  const isCurrentUserPremium = useSelector(selectIsCurrentUserPremium);

  return renderIcon(props, !isCurrentUserPremium);
});

function renderIcon({
  name,
  ref,
  className,
  style,
  role,
  ariaLabel,
  character,
  onClick,
}: OwnProps, hasPremiumBadge?: boolean) {
  return (
    <i
      ref={ref}
      className={buildClassName(`icon icon-${name}`, className, hasPremiumBadge && styles.hasPremiumBadge)}
      style={style}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      data-char={character}
      role={role}
      onClick={onClick}
    />
  );
}

export default Icon;
