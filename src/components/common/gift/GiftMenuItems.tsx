import React, { memo, useMemo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiEmojiStatusCollectible, ApiEmojiStatusType, ApiSavedStarGift, ApiStarGift,
} from '../../../api/types';

import { DEFAULT_STATUS_ICON_ID, TME_LINK_PREFIX } from '../../../config';
import { copyTextToClipboard } from '../../../util/clipboard';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

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
    openGiftStatusInfoModal,
    setEmojiStatus,
    toggleSavedGiftPinned,
    changeGiftVisibility,
  } = getActions();

  const lang = useLang();

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
    if (savedGift?.gift.type !== 'starGiftUnique') return;
    openGiftTransferModal({ gift: savedGift });
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
          {lang(savedGift.isPinned ? 'UnpinFromTop' : 'PinToTop')}
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
      {canManage && savedGift && (
        <MenuItem icon={savedGift.isUnsaved ? 'eye-outline' : 'eye-crossed-outline'} onClick={handleTriggerVisibility}>
          {lang(savedGift.isUnsaved ? 'GiftActionShow' : 'GiftActionHide')}
        </MenuItem>
      )}
      {canWear && (
        <MenuItem icon="crown-wear" onClick={handleWear}>
          {lang('GiftInfoWear')}
        </MenuItem>
      )}
      {canTakeOff && (
        <MenuItem icon="crown-take-off" onClick={handleTakeOff}>
          {lang('GiftInfoTakeOff')}
        </MenuItem>
      )}
    </>
  );
};

export default memo(GiftMenuItems);
