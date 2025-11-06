import type { TeactNode } from '@teact';
import { memo, useMemo } from '@teact';
import { getActions } from '../../../global';

import type {
  ApiPeer,
  ApiSavedStarGift,
  ApiStarGiftAttributeBackdrop, ApiStarGiftAttributeModel, ApiStarGiftAttributePattern,
  ApiTypeCurrencyAmount } from '../../../api/types';

import {
  formatStarsTransactionAmount,
} from '../../../global/helpers/payments';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment.ts';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { REM } from '../../common/helpers/mediaDimensions.ts';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Icon from '../../common/icons/Icon';
import StarIcon from '../../common/icons/StarIcon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Transition from '../../ui/Transition';
import UniqueGiftManageButtons from './UniqueGiftManageButtons';

import styles from './UniqueGiftHeader.module.scss';

type OwnProps = {
  modelAttribute: ApiStarGiftAttributeModel;
  backdropAttribute: ApiStarGiftAttributeBackdrop;
  patternAttribute: ApiStarGiftAttributePattern;
  title?: string;
  subtitle?: TeactNode;
  subtitlePeer?: ApiPeer;
  className?: string;
  resellPrice?: ApiTypeCurrencyAmount;
  showManageButtons?: boolean;
  savedGift?: ApiSavedStarGift;
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
  showManageButtons,
  savedGift,
}: OwnProps) => {
  const {
    openChat,
  } = getActions();

  const lang = useLang();
  const [isGiftHover, markGiftHover, unmarkGiftHover] = useFlag(false);
  const activeKey = useTransitionActiveKey([modelAttribute, backdropAttribute, patternAttribute]);
  const subtitleColor = backdropAttribute?.textColor;

  const radialPatternBackdrop = useMemo(() => {
    const backdropColors = [backdropAttribute.centerColor, backdropAttribute.edgeColor];

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternIcon={patternAttribute.sticker}
        yPosition={6.5 * REM}
      />
    );
  }, [backdropAttribute, patternAttribute]);

  return (
    <div className={buildClassName(styles.root,
      isGiftHover && 'interactive-gift',
      showManageButtons && styles.withManageButtons,
      className)}
    >
      <Transition
        className={styles.transition}
        slideClassName={buildClassName(styles.transitionSlide)}
        activeKey={activeKey}
        direction={1}
        name="zoomBounceSemiFade"
      >
        {radialPatternBackdrop}
        <AnimatedIconFromSticker
          className={styles.sticker}
          sticker={modelAttribute.sticker}
          size={STICKER_SIZE}
          noLoop={!isGiftHover}
          onMouseEnter={!IS_TOUCH_ENV ? markGiftHover : undefined}
          onMouseLeave={!IS_TOUCH_ENV ? unmarkGiftHover : undefined}
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
      {savedGift && showManageButtons && (
        <UniqueGiftManageButtons
          savedGift={savedGift}
        />
      )}
      {resellPrice && (
        <p className={styles.amount}>
          <span>
            {formatStarsTransactionAmount(lang, resellPrice)}
          </span>
          {resellPrice.currency === 'XTR' && <StarIcon type="gold" size="middle" />}
          {resellPrice.currency === 'TON' && <Icon name="toncoin" />}
        </p>
      )}
    </div>
  );
};

export default memo(UniqueGiftHeader);
