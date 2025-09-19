import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiEmojiStatusCollectible,
  ApiEmojiStatusType,
  ApiSavedStarGift,
} from '../../../api/types';

import { DEFAULT_STATUS_ICON_ID } from '../../../config';
import { STARS_CURRENCY_CODE } from '../../../config';
import { selectTabState, selectUser } from '../../../global/selectors';
import { formatDateAtTime } from '../../../util/dates/dateFormat';
import { getServerTime } from '../../../util/serverTime';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Button from '../../ui/Button';

import styles from './UniqueGiftManageButtons.module.scss';

type OwnProps = {
  savedGift?: ApiSavedStarGift;
};

type StateProps = {
  currentUserEmojiStatus?: ApiEmojiStatusType;
  collectibleEmojiStatuses?: ApiEmojiStatusType[];
};

const UniqueGiftManageButtons = ({
  savedGift,
  currentUserEmojiStatus,
  collectibleEmojiStatuses,
}: OwnProps & StateProps) => {
  const {
    openGiftTransferModal,
    openGiftResalePriceComposerModal,
    openGiftStatusInfoModal,
    setEmojiStatus,
    updateStarGiftPrice,
    showNotification,
    closeGiftInfoModal,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const gift = savedGift?.gift;
  const isGiftUnique = gift?.type === 'starGiftUnique';
  const giftResalePrice = isGiftUnique ? gift.resellPrice : undefined;

  const global = getGlobal();
  const modal = selectTabState(global).giftInfoModal;
  const peerId = modal?.peerId;

  const starGiftUniqueSlug = gift?.type === 'starGiftUnique' ? gift.slug : undefined;
  const userCollectibleStatus = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return collectibleEmojiStatuses?.find((status) =>
      status.type === 'collectible' && status.slug === starGiftUniqueSlug,
    ) as ApiEmojiStatusCollectible | undefined;
  }, [starGiftUniqueSlug, collectibleEmojiStatuses]);

  const currentUniqueEmojiStatusSlug = currentUserEmojiStatus?.type === 'collectible'
    ? currentUserEmojiStatus.slug : undefined;
  const canTakeOff = starGiftUniqueSlug !== undefined && currentUniqueEmojiStatusSlug === starGiftUniqueSlug;
  const canWear = Boolean(userCollectibleStatus) && !canTakeOff;

  const handleTransfer = useLastCallback(() => {
    if (!savedGift || savedGift?.gift.type !== 'starGiftUnique') return;

    if (savedGift.canTransferAt && savedGift.canTransferAt > getServerTime()) {
      showNotification({
        message: {
          key: 'NotificationGiftCanTransferAt',
          variables: { date: formatDateAtTime(oldLang, savedGift.canTransferAt * 1000) },
        },
      });
      return;
    }

    openGiftTransferModal({ gift: savedGift });
  });

  const handleWear = useLastCallback(() => {
    if (canTakeOff) {
      setEmojiStatus({
        emojiStatus: { type: 'regular', documentId: DEFAULT_STATUS_ICON_ID },
      });
    } else if (userCollectibleStatus) {
      openGiftStatusInfoModal({ emojiStatus: userCollectibleStatus });
    }
  });

  const handleSell = useLastCallback(() => {
    if (!savedGift || !peerId) return;
    if (savedGift.canResellAt && savedGift.canResellAt > getServerTime()) {
      showNotification({
        message: {
          key: 'NotificationGiftCanResellAt',
          variables: { date: formatDateAtTime(oldLang, savedGift.canResellAt * 1000) },
        },
      });
      return;
    }
    openGiftResalePriceComposerModal({ peerId, gift: savedGift });
  });

  const handleUnlist = useLastCallback(() => {
    if (!savedGift || savedGift.gift.type !== 'starGiftUnique' || !savedGift.inputGift) return;
    closeGiftInfoModal();
    updateStarGiftPrice({ gift: savedGift.inputGift, price: {
      currency: STARS_CURRENCY_CODE, amount: 0, nanos: 0,
    } });
    showNotification({
      icon: 'unlist-outline',
      message: {
        key: 'NotificationGiftIsUnlist',
        variables: { gift: lang('GiftUnique', { title: savedGift.gift.title, number: savedGift.gift.number }) },
      },
    });
  });

  return (
    <div className={styles.manageButtons}>
      <Button
        color="transparentBlured"
        iconName="gift-transfer-inline"
        iconAlignment="top"
        iconClassName={styles.icon}
        onClick={handleTransfer}
        ariaLabel={lang('GiftInfoTransfer')}
        noForcedUpperCase
        fluid
        className={styles.manageButton}
      >
        <span className={styles.text}>
          {lang('GiftInfoTransfer')}
        </span>
      </Button>
      {(canWear || !canTakeOff) && (
        <Button
          color="transparentBlured"
          iconName={canTakeOff ? 'crown-take-off' : 'crown-wear'}
          iconAlignment="top"
          iconClassName={styles.icon}
          onClick={canWear || canTakeOff ? handleWear : undefined}
          disabled={!canWear && !canTakeOff}
          ariaLabel={lang(canTakeOff ? 'GiftInfoTakeOff' : 'GiftInfoWear')}
          noForcedUpperCase
          fluid
          className={styles.manageButton}
        >
          <span className={styles.text}>
            {lang(canTakeOff ? 'GiftInfoTakeOff' : 'GiftInfoWear')}
          </span>
        </Button>
      )}
      {!giftResalePrice && (
        <Button
          color="transparentBlured"
          iconName="sell"
          iconAlignment="top"
          iconClassName={styles.icon}
          onClick={handleSell}
          ariaLabel={lang('Sell')}
          noForcedUpperCase
          fluid
          className={styles.manageButton}
        >
          <span className={styles.text}>
            {lang('Sell')}
          </span>
        </Button>
      )}
      {Boolean(giftResalePrice) && (
        <Button
          color="transparentBlured"
          iconName="unlist"
          iconAlignment="top"
          iconClassName={styles.icon}
          onClick={handleUnlist}
          ariaLabel={lang('GiftInfoUnlist')}
          noForcedUpperCase
          fluid
          className={styles.manageButton}
        >
          <span className={styles.text}>
            {lang('GiftInfoUnlist')}
          </span>
        </Button>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { currentUserId } = global;
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;
    const currentUserEmojiStatus = currentUser?.emojiStatus;
    const collectibleEmojiStatuses = global.collectibleEmojiStatuses?.statuses;

    return {
      currentUserEmojiStatus,
      collectibleEmojiStatuses,
    };
  },
)(UniqueGiftManageButtons));
