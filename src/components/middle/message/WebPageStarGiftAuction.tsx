import { memo, useMemo, useRef, useState } from '../../../lib/teact/teact';

import type { ApiWebPageAuctionData } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { getServerTime } from '../../../util/serverTime';

import useFlag from '../../../hooks/useFlag';
import { type ObserveFn } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import GiftEffectWrapper from '../../common/gift/GiftEffectWrapper';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import StickerView from '../../common/StickerView';
import TextTimer from '../../ui/TextTimer';

import styles from './WebPageStarGiftAuction.module.scss';

type OwnProps = {
  auction: ApiWebPageAuctionData;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const GIFT_STICKER_SIZE = 120;
const DEFAULT_CENTER_COLOR = '#254e7a';
const DEFAULT_EDGE_COLOR = '#0f2a49';

const WebPageStarGiftAuction = ({
  auction,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}: OwnProps) => {
  const lang = useLang();

  const stickerRef = useRef<HTMLDivElement>();
  const [isHover, markHover, unmarkHover] = useFlag();

  const { gift, endDate } = auction;
  const { background, title, availabilityTotal, isSoldOut } = gift;
  const textColor = background?.textColor || '#ffffff';

  const [isFinished, setIsFinished] = useState(() => endDate < getServerTime());

  const handleTimerEnd = useLastCallback(() => {
    setIsFinished(true);
  });

  const backgroundColors = useMemo(() => {
    const centerColor = background?.centerColor || DEFAULT_CENTER_COLOR;
    const edgeColor = background?.edgeColor || DEFAULT_EDGE_COLOR;
    return [centerColor, edgeColor];
  }, [background]);

  const subtitleText = useMemo(() => {
    if (isFinished || isSoldOut) {
      return lang('GiftAuctionSoldOut');
    }
    return lang('GiftAuctionGifts', { count: availabilityTotal || 0 }, { pluralValue: availabilityTotal || 0 });
  }, [availabilityTotal, isFinished, isSoldOut, lang]);

  return (
    <div
      className={buildClassName('interactive-gift', styles.root)}
      style={`color: ${textColor}`}
      onClick={onClick}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
    >
      <RadialPatternBackground
        className={styles.background}
        backgroundColors={backgroundColors}
        withAdaptiveHeight
      />
      <div className={styles.badge} style={`background-color: ${backgroundColors[0]}`}>
        {isFinished ? lang('GiftAuctionFinished') : <TextTimer endsAt={endDate} onEnd={handleTimerEnd} />}
      </div>
      <GiftEffectWrapper
        ref={stickerRef}
        className={styles.stickerWrapper}
        withSparkles
        sparklesColor={textColor}
      >
        <StickerView
          containerRef={stickerRef}
          sticker={gift.sticker}
          size={GIFT_STICKER_SIZE}
          shouldLoop={isHover}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          observeIntersectionForLoading={observeIntersectionForLoading}
        />
      </GiftEffectWrapper>
      <div className={styles.title}>{title}</div>
      <div className={styles.subtitle}>{subtitleText}</div>
    </div>
  );
};

export default memo(WebPageStarGiftAuction);
