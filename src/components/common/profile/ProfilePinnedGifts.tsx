import { memo, useMemo, useRef } from '@teact';
import { getActions } from '../../../global';

import type { ApiSavedStarGift } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { clamp } from '../../../util/math';
import { getGiftAttributes } from '../helpers/gifts';
import { REM } from '../helpers/mediaDimensions';

import { useVtn } from '../../../hooks/animations/useVtn';
import useLastCallback from '../../../hooks/useLastCallback';

import GiftEffectWrapper from '../gift/GiftEffectWrapper';
import StickerView from '../StickerView';

import styles from './ProfilePinnedGifts.module.scss';

type OwnProps = {
  peerId: string;
  className?: string;
  gifts?: ApiSavedStarGift[];
  isExpanded?: boolean;
  withGlow?: boolean;
};

const GIFT_STICKER_SIZE = 2 * REM;
const POSITIONS = [
  { x: -0.2, y: -0.3 },
  { x: 0.3, y: 0.1 },
  { x: -0.4, y: -0.1 },
  { x: 0.4, y: -0.1 },
  { x: -0.25, y: 0.1 },
  { x: 0.25, y: -0.25 },
];

const CENTER = { x: 0.5, y: 0.5 };

const ProfilePinnedGifts = ({
  peerId,
  gifts,
  isExpanded,
  className,
  withGlow,
}: OwnProps) => {
  const { createVtnStyle } = useVtn();

  if (!gifts) return undefined;

  return (
    <div className={buildClassName(styles.root, className)}>
      {gifts.slice(0, POSITIONS.length).map((gift, index) => {
        const position = !isExpanded ? POSITIONS[index] : getExpandedPosition(POSITIONS[index]);
        const style = buildStyle(
          `top: ${(CENTER.y + position.y) * 100}%`,
          `left: ${(CENTER.x + position.x) * 100}%`,
        );
        return (
          <PinnedGift
            peerId={peerId}
            className={styles.gift}
            key={gift.gift.id}
            gift={gift}
            style={buildStyle(style, createVtnStyle(`profilePinnedGift${index}`, 'profilePinnedGift'))}
            withGlow={withGlow}
          />
        );
      })}
    </div>
  );
};

function getExpandedPosition(position: { x: number; y: number }) {
  return {
    x: clamp(position.x * 1.5, -0.45, 0.45),
    y: clamp(position.y * 1.5, -0.45, 0.45),
  };
}

const PinnedGift = ({
  gift, style, className, withGlow, peerId,
}: {
  gift: ApiSavedStarGift;
  style?: string;
  className?: string;
  withGlow?: boolean;
  peerId: string;
}) => {
  const { openGiftInfoModal } = getActions();

  const stickerRef = useRef<HTMLDivElement>();

  const giftAttributes = useMemo(() => {
    return getGiftAttributes(gift.gift);
  }, [gift]);

  const handleClick = useLastCallback(() => {
    openGiftInfoModal({ peerId, gift });
  });

  if (!giftAttributes?.model || !giftAttributes.backdrop) return undefined;

  return (
    <GiftEffectWrapper
      withSparkles
      sparklesColor={giftAttributes.backdrop.textColor}
      glowColor={withGlow ? giftAttributes.backdrop.edgeColor : undefined}
      ref={stickerRef}
      className={className}
      style={style}
      onClick={handleClick}
    >
      <StickerView
        containerRef={stickerRef}
        sticker={giftAttributes.model.sticker}
        size={GIFT_STICKER_SIZE}
        withTranslucentThumb
        noPlay
      />
    </GiftEffectWrapper>
  );
};

export default memo(ProfilePinnedGifts);
