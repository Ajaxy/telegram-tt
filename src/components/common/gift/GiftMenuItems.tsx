import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiEmojiStatusCollectible, ApiEmojiStatusType, ApiSavedStarGift, ApiStarGift,
} from '../../../api/types';

import { DEFAULT_STATUS_ICON_ID, TME_LINK_PREFIX } from '../../../config';
import { STARS_CURRENCY_CODE } from '../../../config';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatDateAtTime } from '../../../util/dates/dateFormat';
import { getServerTime } from '../../../util/serverTime';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import MenuItem from '../../ui/MenuItem';

type OwnProps = {
  peerId: string;
  canManage?: boolean;
  gift: ApiSavedStarGift | ApiStarGift;
  currentUserEmojiStatus?: ApiEmojiStatusType;
  collectibleEmojiStatuses?: ApiEmojiStatusType[];
};

const GiftMenuItems = ({
  peerId,
  canManage,
  gift: typeGift,
  currentUserEmojiStatus,
  collectibleEmojiStatuses,
}: OwnProps) => {
  const {
    showNotification,
    openChatWithDraft,
    openGiftTransferModal,
    openGiftResalePriceComposerModal,
    openGiftStatusInfoModal,
    setEmojiStatus,
    toggleSavedGiftPinned,
    changeGiftVisibility,
    updateStarGiftPrice,
    closeGiftInfoModal,
  } = getActions();

  const lang = useLang();
  const oldLang = useOldLang();

  const isSavedGift = typeGift && 'gift' in typeGift;
  const savedGift = isSavedGift ? typeGift : undefined;
  const gift = isSavedGift ? typeGift.gift : typeGift;

  const starGiftUniqueSlug = gift?.type === 'starGiftUnique' ? gift.slug : undefined;
  const starGiftUniqueLink = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return `${TME_LINK_PREFIX}nft/${starGiftUniqueSlug}`;
  }, [starGiftUniqueSlug]);
  const userCollectibleStatus = useMemo(() => {
    if (!starGiftUniqueSlug) return undefined;
    return collectibleEmojiStatuses?.find((
      status,
    ) => status.type === 'collectible' && status.slug === starGiftUniqueSlug) as ApiEmojiStatusCollectible | undefined;
  }, [starGiftUniqueSlug, collectibleEmojiStatuses]);

  const currenUniqueEmojiStatusSlug = currentUserEmojiStatus?.type === 'collectible'
    ? currentUserEmojiStatus.slug : undefined;

  const isGiftUnique = gift && gift.type === 'starGiftUnique';
  const canTakeOff = isGiftUnique && currenUniqueEmojiStatusSlug === gift.slug;
  const canWear = userCollectibleStatus && !canTakeOff;
  const giftResalePrice = isGiftUnique ? gift.resellPrice : undefined;

  const hasPinOptions = canManage && savedGift && !savedGift.isUnsaved && isGiftUnique;

  const handleTriggerVisibility = useLastCallback(() => {
    const { inputGift, isUnsaved } = savedGift!;
    changeGiftVisibility({ gift: inputGift!, shouldUnsave: !isUnsaved });
  });

  const handleCopyLink = useLastCallback(() => {
    if (!starGiftUniqueLink) return;
    copyTextToClipboard(starGiftUniqueLink);
    showNotification({
      message: lang('LinkCopied'),
    });
  });

  const handleLinkShare = useLastCallback(() => {
    if (!starGiftUniqueLink) return;
    openChatWithDraft({ text: { text: starGiftUniqueLink } });
  });

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

  const handleSell = useLastCallback(() => {
    if (!savedGift) return;
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

  const handleUnsell = useLastCallback(() => {
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

  const handleWear = useLastCallback(() => {
    if (gift?.type !== 'starGiftUnique' || !userCollectibleStatus) return;
    openGiftStatusInfoModal({ emojiStatus: userCollectibleStatus });
  });

  const handleTakeOff = useLastCallback(() => {
    if (canTakeOff) {
      setEmojiStatus({
        emojiStatus: { type: 'regular', documentId: DEFAULT_STATUS_ICON_ID },
      });
    }
  });

  const handleTogglePin = useLastCallback(() => {
    toggleSavedGiftPinned({ peerId, gift: savedGift! });
  });

  return (
    <>
      {hasPinOptions && (
        <MenuItem icon={savedGift.isPinned ? 'unpin' : 'pin'} onClick={handleTogglePin}>
          {lang(savedGift.isPinned ? 'ChatListUnpinFromTop' : 'ChatListPinToTop')}
        </MenuItem>
      )}
      <MenuItem icon="link-badge" onClick={handleCopyLink}>
        {lang('CopyLink')}
      </MenuItem>
      <MenuItem icon="forward" onClick={handleLinkShare}>
        {lang('Share')}
      </MenuItem>
      {canManage && isGiftUnique && (
        <MenuItem icon="diamond" onClick={handleTransfer}>
          {lang('GiftInfoTransfer')}
        </MenuItem>
      )}
      {canManage && isGiftUnique && !giftResalePrice && (
        <MenuItem icon="sell-outline" onClick={handleSell}>
          {lang('Sell')}
        </MenuItem>
      )}
      {canManage && isGiftUnique && Boolean(giftResalePrice) && (
        <MenuItem icon="unlist-outline" onClick={handleUnsell}>
          {lang('GiftInfoUnlist')}
        </MenuItem>
      )}
      {canManage && savedGift && (
        <MenuItem icon={savedGift.isUnsaved ? 'eye-outline' : 'eye-crossed-outline'} onClick={handleTriggerVisibility}>
          {lang(savedGift.isUnsaved ? 'GiftActionShow' : 'GiftActionHide')}
        </MenuItem>
      )}
      {canWear && (
        <MenuItem icon="crown-wear-outline" onClick={handleWear}>
          {lang('GiftInfoWear')}
        </MenuItem>
      )}
      {canTakeOff && (
        <MenuItem icon="crown-take-off-outline" onClick={handleTakeOff}>
          {lang('GiftInfoTakeOff')}
        </MenuItem>
      )}
    </>
  );
};

export default memo(GiftMenuItems);
