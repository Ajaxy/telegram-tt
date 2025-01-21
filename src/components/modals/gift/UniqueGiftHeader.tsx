import React, { memo, useMemo } from '../../../lib/teact/teact';

import type {
  ApiStarGiftAttributeBackdrop, ApiStarGiftAttributeModel, ApiStarGiftAttributePattern,
} from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Transition from '../../ui/Transition';

import styles from './UniqueGiftHeader.module.scss';

type OwnProps = {
  modelAttribute: ApiStarGiftAttributeModel;
  backdropAttribute: ApiStarGiftAttributeBackdrop;
  patternAttribute: ApiStarGiftAttributePattern;
  title?: string;
  subtitle?: string;
  className?: string;
};

const STICKER_SIZE = 120;

const UniqueGiftHeader = ({
  modelAttribute,
  backdropAttribute,
  patternAttribute,
  title,
  subtitle,
  className,
}: OwnProps) => {
  const activeKey = useTransitionActiveKey([modelAttribute, backdropAttribute, patternAttribute]);
  const subtitleColor = backdropAttribute?.textColor;

  const radialPatternBackdrop = useMemo(() => {
    const backdropColors = [backdropAttribute.centerColor, backdropAttribute.edgeColor];
    const patternColor = backdropAttribute.patternColor;

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternColor={patternColor}
        patternIcon={patternAttribute.sticker}
      />
    );
  }, [backdropAttribute, patternAttribute]);

  return (
    <div className={buildClassName(styles.root, className)}>
      <Transition
        className={styles.transition}
        slideClassName={styles.transitionSlide}
        activeKey={activeKey}
        direction={1}
        name="zoomBounceSemiFade"
      >
        {radialPatternBackdrop}
        <AnimatedIconFromSticker
          className={styles.sticker}
          sticker={modelAttribute.sticker}
          size={STICKER_SIZE}
        />
      </Transition>
      {title && <h1 className={styles.title}>{title}</h1>}
      {subtitle && (
        <p className={styles.subtitle} style={buildStyle(subtitleColor && `color: ${subtitleColor}`)}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default memo(UniqueGiftHeader);
