import type { ElementRef } from '@teact';
import { memo, type TeactNode, useRef } from '@teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import Sparkles from '../Sparkles';

import styles from './GiftEffectWrapper.module.scss';

type OwnProps = {
  children: TeactNode;
  ref?: ElementRef<HTMLDivElement>;
  className?: string;
  style?: string;
  withSparkles?: boolean;
  sparklesClassName?: string;
  sparklesColor?: string;
  glowColor?: string;
  onClick?: NoneToVoidFunction;
};

const GiftEffectWrapper = ({
  children,
  ref,
  className,
  style,
  withSparkles,
  sparklesClassName,
  sparklesColor,
  glowColor,
  onClick,
}: OwnProps) => {
  let containerRef = useRef<HTMLDivElement>();
  if (ref) {
    containerRef = ref;
  }

  return (
    <div
      ref={containerRef}
      className={buildClassName(styles.root, className)}
      style={buildStyle(glowColor && `--glow-color: ${glowColor}`, style)}
      onClick={onClick}
    >
      {withSparkles && (
        <Sparkles
          preset="button"
          className={buildClassName(styles.sparkles, sparklesClassName)}
          style={buildStyle(sparklesColor && `color: ${sparklesColor}`)}
        />
      )}
      {children}
    </div>
  );
};

export default memo(GiftEffectWrapper);
