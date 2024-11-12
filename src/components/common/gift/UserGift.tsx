import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSticker, ApiUser, ApiUserStarGift } from '../../../api/types';

import { STARS_CURRENCY_CODE } from '../../../config';
import { selectUser } from '../../../global/selectors';
import { formatCurrency } from '../../../util/formatCurrency';
import { CUSTOM_PEER_HIDDEN } from '../../../util/objects/customPeer';
import { formatIntegerCompact } from '../../../util/textFormat';

import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../AnimatedIconFromSticker';
import Avatar from '../Avatar';
import Icon from '../icons/Icon';
import GiftRibbon from './GiftRibbon';

import styles from './UserGift.module.scss';

type OwnProps = {
  userId: string;
  gift: ApiUserStarGift;
};

type StateProps = {
  fromPeer?: ApiUser;
  sticker?: ApiSticker;
};

const GIFT_STICKER_SIZE = 90;

const UserGift = ({
  userId, gift, fromPeer, sticker,
}: OwnProps & StateProps) => {
  const { openGiftInfoModal } = getActions();

  const oldLang = useOldLang();

  const handleClick = useLastCallback(() => {
    openGiftInfoModal({
      userId,
      gift,
    });
  });

  const avatarPeer = (gift.isNameHidden || !fromPeer) ? CUSTOM_PEER_HIDDEN : fromPeer;

  if (!sticker) return undefined;

  return (
    <div className={styles.root} onClick={handleClick}>
      <Avatar className={styles.avatar} peer={avatarPeer} size="micro" />
      <AnimatedIconFromSticker
        sticker={sticker}
        noLoop
        nonInteractive
        size={GIFT_STICKER_SIZE}
      />
      {gift.isUnsaved && (
        <div className={styles.hiddenGift}>
          <Icon name="eye-closed-outline" />
        </div>
      )}
      <div className={styles.stars}>
        {formatCurrency(gift.gift.stars, STARS_CURRENCY_CODE)}
      </div>
      {gift.gift.availabilityTotal && (
        <GiftRibbon
          color="blue"
          text={oldLang('Gift2Limited1OfRibbon', formatIntegerCompact(gift.gift.availabilityTotal))}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { gift }): StateProps => {
    const sticker = global.stickers.starGifts.stickers[gift.gift.stickerId];
    const fromPeer = gift.fromId ? selectUser(global, gift.fromId) : undefined;

    return {
      sticker,
      fromPeer,
    };
  },
)(UserGift));
