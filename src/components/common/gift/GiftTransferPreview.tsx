import { memo, useMemo } from '../../../lib/teact/teact';

import type {
  ApiPeer, ApiStarGiftUnique,
} from '../../../api/types';

import { getGiftAttributes } from '../helpers/gifts';
import { REM } from '../helpers/mediaDimensions';

import AnimatedIconFromSticker from '../AnimatedIconFromSticker';
import Avatar from '../Avatar';
import Icon from '../icons/Icon';
import RadialPatternBackground from '../profile/RadialPatternBackground';

import styles from './GiftTransferPreview.module.scss';

type OwnProps = {
  peer: ApiPeer;
  gift: ApiStarGiftUnique;
};

const AVATAR_SIZE = 4 * REM;
const GIFT_STICKER_SIZE = 3 * REM;

const GiftTransferPreview = ({
  peer,
  gift,
}: OwnProps) => {
  const giftAttributes = useMemo(() => {
    return getGiftAttributes(gift);
  }, [gift]);

  if (!giftAttributes) return undefined;

  return (
    <div className={styles.root}>
      <div className={styles.giftPreview}>
        <RadialPatternBackground
          className={styles.backdrop}
          backgroundColors={[giftAttributes.backdrop!.centerColor, giftAttributes.backdrop!.edgeColor]}
          patternIcon={giftAttributes.pattern?.sticker}
          ringsCount={1}
          ovalFactor={1}
          patternSize={12}
        />
        <AnimatedIconFromSticker
          className={styles.sticker}
          size={GIFT_STICKER_SIZE}
          sticker={giftAttributes.model?.sticker}
        />
      </div>
      <Icon name="next" className={styles.arrow} />
      <Avatar
        peer={peer}
        size={AVATAR_SIZE}
        className={styles.avatar}
      />
    </div>
  );
};

export default memo(GiftTransferPreview);
