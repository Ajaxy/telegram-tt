import { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type {
  ApiPeer,
  ApiStarsTransaction,
} from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { CustomPeer } from '../../../../types';

import { STARS_CURRENCY_CODE, TON_CURRENCY_CODE } from '../../../../config';
import { buildStarsTransactionCustomPeer,
  formatStarsTransactionAmount,
  shouldUseCustomPeer } from '../../../../global/helpers/payments';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { selectPeer } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatDateTimeToString } from '../../../../util/dates/dateFormat';
import { CUSTOM_PEER_PREMIUM } from '../../../../util/objects/customPeer';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import renderText from '../../../common/helpers/renderText';
import { getTransactionTitle, isNegativeAmount } from '../helpers/transaction';

import useSelector from '../../../../hooks/data/useSelector';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useOldLang from '../../../../hooks/useOldLang';

import AnimatedIconFromSticker from '../../../common/AnimatedIconFromSticker';
import Avatar from '../../../common/Avatar';
import Icon from '../../../common/icons/Icon';
import StarIcon from '../../../common/icons/StarIcon';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import PaidMediaThumb from './PaidMediaThumb';

import styles from './StarsTransactionItem.module.scss';

type OwnProps = {
  transaction: ApiStarsTransaction;
  className?: string;
};

const GIFT_STICKER_SIZE = 36;

function selectOptionalPeer(peerId?: string) {
  return (global: GlobalState) => (
    peerId ? selectPeer(global, peerId) : undefined
  );
}

const StarsTransactionItem = ({ transaction, className }: OwnProps) => {
  const { openStarsTransactionModal } = getActions();
  const {
    date,
    amount,
    photo,
    peer: transactionPeer,
    extendedMedia,
    subscriptionPeriod,
  } = transaction;
  const lang = useLang();
  const oldLang = useOldLang();

  const peerId = transactionPeer.type === 'peer' ? transactionPeer.id : undefined;
  const peer = useSelector(selectOptionalPeer(peerId));
  const starGift = transaction.starGift;
  const isUniqueGift = starGift?.type === 'starGiftUnique';
  const giftSticker = starGift && getStickerFromGift(starGift);

  const data = useMemo(() => {
    let title = getTransactionTitle(oldLang, lang, transaction);
    let description;
    let status: string | undefined;
    let avatarPeer: ApiPeer | CustomPeer | undefined;

    if (!shouldUseCustomPeer(transaction)) {
      description = peer && getPeerTitle(oldLang, peer);
      avatarPeer = peer || CUSTOM_PEER_PREMIUM;
    } else {
      const customPeer = buildStarsTransactionCustomPeer(transaction);
      title = customPeer.title || oldLang(customPeer.titleKey!);
      description = oldLang(customPeer.subtitleKey!);
      avatarPeer = customPeer;
    }

    if ((transaction.isGiftUpgrade || transaction.isDropOriginalDetails)
      && transaction.starGift?.type === 'starGiftUnique') {
      description = lang('GiftUnique', { title: transaction.starGift.title, number: transaction.starGift.number });
    }

    if (transaction.isGiftResale && transaction.starGift?.type === 'starGiftUnique') {
      description = lang('GiftUnique', { title: transaction.starGift.title, number: transaction.starGift.number });
    }

    if (transaction.isPostsSearch) {
      title = getTransactionTitle(oldLang, lang, transaction);
      description = undefined;
    }

    if (transaction.photo) {
      avatarPeer = undefined;
    }

    if (transaction.isRefund) {
      status = oldLang('StarsRefunded');
    }

    if (transaction.hasFailed) {
      status = oldLang('StarsFailed');
    }

    if (transaction.isPending) {
      status = oldLang('StarsPending');
    }

    return {
      title,
      description,
      avatarPeer,
      status,
    };
  }, [oldLang, lang, peer, transaction]);

  const previewContent = useMemo(() => {
    if (isUniqueGift) {
      const { backdrop } = getGiftAttributes(starGift)!;
      const backgroundColors = [backdrop!.centerColor, backdrop!.edgeColor];

      return (
        <>
          <RadialPatternBackground
            className={styles.uniqueGiftBackground}
            backgroundColors={backgroundColors}
          />
          <AnimatedIconFromSticker
            className={styles.giftSticker}
            sticker={giftSticker}
            size={GIFT_STICKER_SIZE}
            play={false}
          />
        </>
      );
    }

    if (giftSticker) {
      return (
        <AnimatedIconFromSticker
          className={styles.giftSticker}
          sticker={giftSticker}
          size={GIFT_STICKER_SIZE}
          play={false}
        />
      );
    }

    if (extendedMedia) {
      return <PaidMediaThumb media={extendedMedia} isTransactionPreview />;
    }

    return (
      <>
        <Avatar size="medium" webPhoto={photo} peer={data.avatarPeer} />
        {Boolean(subscriptionPeriod) && (
          <StarIcon className={styles.subscriptionStar} type="gold" size="small" />
        )}
      </>
    );
  }, [isUniqueGift, extendedMedia, photo, data.avatarPeer, subscriptionPeriod, starGift, giftSticker]);

  const handleClick = useLastCallback(() => {
    openStarsTransactionModal({ transaction });
  });

  const amountColorClass = isNegativeAmount(amount) ? styles.negative : styles.positive;

  return (
    <div className={buildClassName(styles.root, className)} onClick={handleClick}>
      <div className={styles.preview}>
        {previewContent}
      </div>
      <div className={styles.info}>
        <h3 className={styles.title}>{data.title}</h3>
        {data.description && (
          <p className={styles.description}>{renderText(data.description)}</p>
        )}
        <p className={styles.date}>
          {formatDateTimeToString(date * 1000, oldLang.code, true)}
          {data.status && ` — (${data.status})`}
        </p>
      </div>
      <div className={styles.stars}>
        <span
          className={buildClassName(styles.amount, amountColorClass)}
        >
          {formatStarsTransactionAmount(lang, amount)}
        </span>
        {amount.currency === STARS_CURRENCY_CODE && <StarIcon className={styles.star} type="gold" size="adaptive" />}
        {amount.currency === TON_CURRENCY_CODE && <Icon name="toncoin" className={amountColorClass} />}
      </div>
    </div>
  );
};

export default memo(StarsTransactionItem);
