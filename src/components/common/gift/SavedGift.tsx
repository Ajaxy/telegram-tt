import { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiEmojiStatusType, ApiPeer, ApiSavedStarGift } from '../../../api/types';

import { getHasAdminRight } from '../../../global/helpers';
import { selectChat, selectPeer, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { CUSTOM_PEER_HIDDEN } from '../../../util/objects/customPeer';
import { formatIntegerCompact } from '../../../util/textFormat';
import { getGiftAttributes, getStickerFromGift, getTotalGiftAvailability } from '../helpers/gifts';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { type ObserveFn } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import StickerView from '../../common/StickerView';
import Menu from '../../ui/Menu';
import Avatar from '../Avatar';
import Icon from '../icons/Icon';
import RadialPatternBackground from '../profile/RadialPatternBackground';
import GiftMenuItems from './GiftMenuItems';
import GiftRibbon from './GiftRibbon';

import styles from './SavedGift.module.scss';

type OwnProps = {
  peerId: string;
  gift: ApiSavedStarGift;
  style?: string;
  observeIntersection?: ObserveFn;
};

type StateProps = {
  fromPeer?: ApiPeer;
  currentUserId?: string;
  hasAdminRights?: boolean;
  currentUserEmojiStatus?: ApiEmojiStatusType;
  collectibleEmojiStatuses?: ApiEmojiStatusType[];
};

const GIFT_STICKER_SIZE = 90;

const SavedGift = ({
  peerId,
  gift,
  style,
  fromPeer,
  currentUserId,
  hasAdminRights,
  collectibleEmojiStatuses,
  currentUserEmojiStatus,
  observeIntersection,
}: OwnProps & StateProps) => {
  const { openGiftInfoModal } = getActions();

  const ref = useRef<HTMLDivElement>();

  const stickerRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const canManage = peerId === currentUserId || hasAdminRights;

  const totalIssued = getTotalGiftAvailability(gift.gift);
  const starGift = gift.gift;
  const starGiftUnique = starGift.type === 'starGiftUnique' ? starGift : undefined;
  const ribbonText = (() => {
    if (starGiftUnique?.resellPriceInStars) {
      return lang('GiftRibbonSale');
    }
    if (gift.isPinned && starGiftUnique) {
      return lang('GiftSavedNumber', { number: starGiftUnique.number });
    }
    if (totalIssued) {
      return lang('ActionStarGiftLimitedRibbon', { total: formatIntegerCompact(lang, totalIssued) });
    }
    return undefined;
  })();

  const ribbonColor = starGiftUnique?.resellPriceInStars ? 'green' : 'blue';

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);

  const getTriggerElement = useLastCallback(() => ref.current);
  const getRootElement = useLastCallback(() => ref.current!.closest('.custom-scroll'));
  const getMenuElement = useLastCallback(() => (
    document.querySelector('#portals')?.querySelector('.saved-gift-context-menu .bubble')
  ));
  const getLayout = useLastCallback(() => ({ withPortal: true }));

  const handleClick = useLastCallback(() => {
    openGiftInfoModal({
      peerId,
      gift,
    });
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

  if (!sticker) return undefined;

  return (
    <div
      ref={ref}
      className={buildClassName(styles.root, 'scroll-item')}
      style={style}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleBeforeContextMenu}
    >
      {radialPatternBackdrop}
      {!radialPatternBackdrop && <Avatar className={styles.topIcon} peer={avatarPeer} size="micro" />}
      {gift.isPinned && <Icon name="pinned-message" className={styles.topIcon} />}
      <div
        ref={stickerRef}
        className={styles.stickerWrapper}
        style={`width: ${GIFT_STICKER_SIZE}px; height: ${GIFT_STICKER_SIZE}px`}
      >
        {sticker && (
          <StickerView
            observeIntersectionForPlaying={observeIntersection}
            observeIntersectionForLoading={observeIntersection}
            containerRef={stickerRef}
            sticker={sticker}
            size={GIFT_STICKER_SIZE}
            shouldPreloadPreview
          />
        )}

      </div>
      {gift.isUnsaved && (
        <div className={styles.hiddenGift}>
          <Icon name="eye-crossed-outline" />
        </div>
      )}
      {ribbonText && (
        <GiftRibbon
          color={ribbonColor}
          text={ribbonText}
        />
      )}
      {contextMenuAnchor !== undefined && (
        <Menu
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          className="saved-gift-context-menu"
          autoClose
          withPortal
          getMenuElement={getMenuElement}
          getTriggerElement={getTriggerElement}
          getRootElement={getRootElement}
          getLayout={getLayout}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        >
          <GiftMenuItems
            peerId={peerId}
            gift={gift}
            canManage={canManage}
            collectibleEmojiStatuses={collectibleEmojiStatuses}
            currentUserEmojiStatus={currentUserEmojiStatus}
          />
        </Menu>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId, gift }): StateProps => {
    const fromPeer = gift.fromId ? selectPeer(global, gift.fromId) : undefined;
    const chat = selectChat(global, peerId);
    const hasAdminRights = chat && getHasAdminRight(chat, 'postMessages');

    const currentUserId = global.currentUserId;
    const currentUser = currentUserId ? selectUser(global, currentUserId) : undefined;
    const currentUserEmojiStatus = currentUser?.emojiStatus;
    const collectibleEmojiStatuses = global.collectibleEmojiStatuses?.statuses;

    return {
      fromPeer,
      hasAdminRights,
      currentUserId,
      currentUserEmojiStatus,
      collectibleEmojiStatuses,
    };
  },
)(SavedGift));
