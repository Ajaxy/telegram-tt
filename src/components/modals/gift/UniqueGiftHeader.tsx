import type { TeactNode } from '../../../lib/teact/teact';
import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiPeer,
  ApiStarGiftAttributeBackdrop, ApiStarGiftAttributeModel, ApiStarGiftAttributePattern,
  ApiStarsAmount } from '../../../api/types';

import {
  formatStarsTransactionAmount,
} from '../../../global/helpers/payments';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useLang from '../../../hooks/useLang';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import StarIcon from '../../common/icons/StarIcon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Transition from '../../ui/Transition';

import styles from './UniqueGiftHeader.module.scss';

type OwnProps = {
  modelAttribute: ApiStarGiftAttributeModel;
  backdropAttribute: ApiStarGiftAttributeBackdrop;
  patternAttribute: ApiStarGiftAttributePattern;
  title?: string;
  subtitle?: TeactNode;
  subtitlePeer?: ApiPeer;
  className?: string;
  resellPrice?: ApiStarsAmount;
};

const STICKER_SIZE = 120;

const UniqueGiftHeader = ({
  modelAttribute,
  backdropAttribute,
  patternAttribute,
  title,
  subtitle,
  subtitlePeer,
  className,
  resellPrice,
}: OwnProps) => {
  const {
    openChat,
  } = getActions();

  const lang = useLang();
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
      {Boolean(subtitle) && (
        <div
          className={buildClassName(styles.subtitle, subtitlePeer && styles.subtitleBadge)}
          style={buildStyle(subtitleColor && `color: ${subtitleColor}`)}
          onClick={() => {
            if (subtitlePeer) {
              openChat({ id: subtitlePeer.id });
            }
          }}
        >
          {subtitle}
        </div>
      )}
      {resellPrice && (
        <p className={styles.amount}>
          <span>
            {formatStarsTransactionAmount(lang, resellPrice)}
          </span>
          <StarIcon type="gold" size="middle" />
        </p>
      )}
    </div>
  );
};

export default memo(UniqueGiftHeader);
