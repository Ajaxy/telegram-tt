import { memo, useMemo } from '../../../lib/teact/teact';

import type { ApiWalletCollectible } from '../../../api/types';

import { getWebDocumentHash } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { getGiftAttributes } from '../../common/helpers/gifts';

import useFlag from '../../../hooks/useFlag';
import useMedia from '../../../hooks/useMedia';
import useMediaTransition from '../../../hooks/useMediaTransition';

import AnimatedIconFromSticker from '../../common/AnimatedIconFromSticker';
import Icon from '../../common/icons/Icon';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Skeleton from '../../ui/placeholder/Skeleton';

import styles from './WalletCollectibleImage.module.scss';

type OwnProps = {
  collectible: ApiWalletCollectible;
  isFull?: boolean;
  className?: string;
};

const GIFT_STICKER_SIZE = 32;
const FULL_GIFT_STICKER_SIZE = 96;

const WalletCollectibleImage = ({ collectible, isFull, className }: OwnProps) => {
  const { image, imageSmall } = collectible;
  const document = isFull ? (image ?? imageSmall) : (imageSmall ?? image);
  const imageUrl = useMedia(getWebDocumentHash(document));
  const { ref } = useMediaTransition<HTMLImageElement>({ hasMediaData: Boolean(imageUrl) });
  const [isBroken, markBroken] = useFlag();
  const giftPreview = useMemo(() => {
    const { model, backdrop, pattern } = (collectible.type === 'gift' && collectible.gift
      && getGiftAttributes(collectible.gift)) || {};
    if (!model || !backdrop) return undefined;

    return { model, pattern, backdropColors: [backdrop.centerColor, backdrop.edgeColor] };
  }, [collectible]);

  function renderContent() {
    // The server lists a gift moved through Telegram without an image, so the gift itself is drawn
    if (!document && giftPreview) {
      return (
        <>
          <RadialPatternBackground
            className={styles.giftBackdrop}
            backgroundColors={giftPreview.backdropColors}
            patternIcon={isFull ? giftPreview.pattern?.sticker : undefined}
          />
          <AnimatedIconFromSticker
            className={styles.giftSticker}
            sticker={giftPreview.model.sticker}
            size={isFull ? FULL_GIFT_STICKER_SIZE : GIFT_STICKER_SIZE}
            play={false}
          />
        </>
      );
    }

    if (!document || isBroken) {
      return <Icon name="gift" className={styles.placeholder} />;
    }

    if (!imageUrl) {
      return <Skeleton animation="wave" />;
    }

    return (
      <img ref={ref} src={imageUrl} alt="" draggable={false} className={styles.image} onError={markBroken} />
    );
  }

  return (
    <div className={buildClassName(styles.root, className)}>
      {renderContent()}
    </div>
  );
};

export default memo(WalletCollectibleImage);
