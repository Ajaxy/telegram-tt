import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer, ApiSavedStarGift } from '../../../api/types';

import { selectPeer } from '../../../global/selectors';
import { CUSTOM_PEER_HIDDEN } from '../../../util/objects/customPeer';
import { formatIntegerCompact } from '../../../util/textFormat';
import { getGiftAttributes, getStickerFromGift, getTotalGiftAvailability } from '../helpers/gifts';

import useFlag from '../../../hooks/useFlag';
import { type ObserveFn, useOnIntersect } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../AnimatedIconFromSticker';
import Avatar from '../Avatar';
import Icon from '../icons/Icon';
import RadialPatternBackground from '../profile/RadialPatternBackground';
import GiftRibbon from './GiftRibbon';

import styles from './SavedGift.module.scss';

type OwnProps = {
  peerId: string;
  gift: ApiSavedStarGift;
  observeIntersection?: ObserveFn;
};

type StateProps = {
  fromPeer?: ApiPeer;
};

const GIFT_STICKER_SIZE = 90;

const SavedGift = ({
  peerId,
  gift,
  fromPeer,
  observeIntersection,
}: OwnProps & StateProps) => {
  const { openGiftInfoModal } = getActions();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const [shouldPlay, play] = useFlag();

  const oldLang = useOldLang();

  const handleClick = useLastCallback(() => {
    openGiftInfoModal({
      peerId,
      gift,
    });
  });

  const handleOnIntersect = useLastCallback((entry: IntersectionObserverEntry) => {
    if (entry.isIntersecting) play();
  });

  const avatarPeer = (gift.isNameHidden && !fromPeer) ? CUSTOM_PEER_HIDDEN : fromPeer;

  const sticker = getStickerFromGift(gift.gift);

  const radialPatternBackdrop = useMemo(() => {
    const { backdrop, pattern } = getGiftAttributes(gift.gift) || {};

    if (!backdrop || !pattern) {
      return undefined;
    }

    const backdropColors = [backdrop.centerColor, backdrop.edgeColor];
    const patternColor = backdrop.patternColor;

    return (
      <RadialPatternBackground
        className={styles.radialPattern}
        backgroundColors={backdropColors}
        patternColor={patternColor}
        patternIcon={pattern.sticker}
      />
    );
  }, [gift.gift]);

  useOnIntersect(ref, observeIntersection, sticker ? handleOnIntersect : undefined);

  if (!sticker) return undefined;

  const totalIssued = getTotalGiftAvailability(gift.gift);

  return (
    <div ref={ref} className={styles.root} onClick={handleClick}>
      {radialPatternBackdrop}
      {!radialPatternBackdrop && <Avatar className={styles.avatar} peer={avatarPeer} size="micro" />}
      <AnimatedIconFromSticker
        sticker={sticker}
        noLoop
        play={shouldPlay}
        nonInteractive
        size={GIFT_STICKER_SIZE}
      />
      {gift.isUnsaved && (
        <div className={styles.hiddenGift}>
          <Icon name="eye-closed-outline" />
        </div>
      )}
      {totalIssued && (
        <GiftRibbon
          color="blue"
          text={oldLang('Gift2Limited1OfRibbon', formatIntegerCompact(totalIssued))}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { gift }): StateProps => {
    const fromPeer = gift.fromId ? selectPeer(global, gift.fromId) : undefined;

    return {
      fromPeer,
    };
  },
)(SavedGift));
