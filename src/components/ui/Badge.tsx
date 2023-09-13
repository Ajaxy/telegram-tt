import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import AnimatedCounter from '../common/AnimatedCounter';
import ShowTransition from './ShowTransition';

import styles from './Badge.module.scss';

type OwnProps = {
  text?: string;
  className?: string;
  isAlternateColor?: boolean;
};

const Badge: FC<OwnProps> = ({
  text,
  className,
  isAlternateColor,
}) => {
  return (
    <ShowTransition
      className={buildClassName(styles.root, isAlternateColor ? styles.alternate : styles.default, className)}
      isOpen={Boolean(text)}
    >
      {text && <AnimatedCounter text={text} />}
    </ShowTransition>
  );
};

export default memo(Badge);
