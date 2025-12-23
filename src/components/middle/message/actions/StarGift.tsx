import { memo, useMemo, useRef } from '@teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionStarGift } from '../../../../api/types/messageActions';

import { isChatChannel } from '../../../../global/helpers';
import { getPeerTitle, isApiPeerChat } from '../../../../global/helpers/peers';
import {
  selectCanPlayAnimatedEmojis,
  selectPeer,
  selectSender,
  selectUser,
} from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment.ts';
import buildClassName from '../../../../util/buildClassName';
import { formatStarsAsText } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import { formatIntegerCompact } from '../../../../util/textFormat';
import { getStickerFromGift } from '../../../common/helpers/gifts';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';
import { renderPeerLink, translateWithYou } from '../helpers/messageActions';

import useDynamicColorListener from '../../../../hooks/stickers/useDynamicColorListener';
import useFlag from '../../../../hooks/useFlag.ts';
import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import GiftRibbon from '../../../common/gift/GiftRibbon';
import Sparkles from '../../../common/Sparkles';
import StickerView from '../../../common/StickerView';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionStarGift;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  canPlayAnimatedEmojis: boolean;
  sender?: ApiPeer;
  recipient?: ApiPeer;
  starGiftMaxConvertPeriod?: number;
};

const STICKER_SIZE = 120;

const StarGiftAction = ({
  action,
  message,
  canPlayAnimatedEmojis,
  sender,
  recipient,
  starGiftMaxConvertPeriod,
  onClick,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  const ref = useRef<HTMLDivElement>();
  const stickerRef = useRef<HTMLDivElement>();
  const lang = useLang();

  const [isHover, markHover, unmarkHover] = useFlag();

  const { isOutgoing } = message;

  const sticker = getStickerFromGift(action.gift)!;

  const peer = isOutgoing ? recipient : sender;
  const isChannel = peer && isApiPeerChat(peer) && isChatChannel(peer);
  const isAuction = action.isAuctionAcquired;

  const backgroundColor = useDynamicColorListener(ref, 'background-color', !action.gift.availabilityTotal);

  const fallbackPeerTitle = lang('ActionFallbackSomeone');
  const peerTitle = peer && getPeerTitle(lang, peer);
  const auctionToTitle = recipient && getPeerTitle(lang, recipient);
  const isSelf = sender?.id === recipient?.id;

  const auctionBid = isAuction ? action.gift.stars : undefined;

  const giftDescription = useMemo(() => {
    const peerLink = renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle);
    const starsAmount = action.starsToConvert !== undefined
      ? formatStarsAsText(lang, action.starsToConvert) : undefined;

    if (isAuction && auctionBid !== undefined) {
      return lang('ActionStarGiftAuctionBought', { cost: formatStarsAsText(lang, auctionBid) });
    }

    if (action.isUpgraded) {
      return lang('ActionStarGiftUpgraded');
    }

    if (action.alreadyPaidUpgradeStars && !isAuction) {
      return translateWithYou(
        lang, 'ActionStarGiftUpgradeText', !isOutgoing || isSelf, { peer: peerLink },
      );
    }

    if (action.isConverted) {
      return translateWithYou(
        lang, 'ActionStarGiftConvertedText', !isOutgoing || isSelf, { peer: peerLink, amount: starsAmount },
      );
    }

    if (starGiftMaxConvertPeriod && getServerTime() < message.date + starGiftMaxConvertPeriod && starsAmount) {
      return translateWithYou(
        lang, 'ActionStarGiftConvertText', !isOutgoing || isSelf, { peer: peerLink, amount: starsAmount },
      );
    }

    if (isChannel) {
      return lang(
        'ActionStarGiftChannelText', { amount: starsAmount }, { withNodes: true },
      );
    }

    return translateWithYou(
      lang, 'ActionStarGiftNoConvertText', !isOutgoing || isSelf, { peer: peerLink },
    );
  }, [
    action, auctionBid, fallbackPeerTitle, isAuction, isChannel, isOutgoing, lang, message.date, peer?.id, peerTitle,
    starGiftMaxConvertPeriod, isSelf,
  ]);

  return (
    <div
      ref={ref}
      className={buildClassName('interactive-gift', styles.contentBox, styles.starGift)}
      tabIndex={0}
      role="button"
      onClick={onClick}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
    >
      <div
        ref={stickerRef}
        className={styles.stickerWrapper}
        style={`width: ${STICKER_SIZE}px; height: ${STICKER_SIZE}px`}
      >
        {sticker && (
          <StickerView
            containerRef={stickerRef}
            sticker={sticker}
            size={STICKER_SIZE}
            shouldLoop={isHover}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            noLoad={!canPlayAnimatedEmojis}
          />
        )}
      </div>
      {Boolean(action.gift.availabilityTotal) && (
        <GiftRibbon
          color={backgroundColor || 'blue'}
          text={lang('ActionStarGiftLimitedRibbon', {
            total: formatIntegerCompact(lang, action.gift.availabilityTotal),
          })}
        />
      )}
      <div className={styles.info}>
        <h3 className={styles.title}>
          {isAuction && recipient ? lang(
            'ActionStarGiftAuctionFor',
            { peer: renderPeerLink(recipient.id, auctionToTitle || fallbackPeerTitle) },
            { withNodes: true },
          ) : isSelf ? lang('ActionStarGiftSelf') : lang(
            isOutgoing ? 'ActionStarGiftTo' : 'ActionStarGiftFrom',
            {
              peer: renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle),
            },
            {
              withNodes: true,
            },
          )}
        </h3>
        <div className={styles.subtitle}>
          {action.message && renderTextWithEntities(action.message)}
          {!action.message && giftDescription}
        </div>
      </div>
      <div className={styles.actionButton}>
        <Sparkles preset="button" />
        {action.alreadyPaidUpgradeStars && !action.isUpgraded && !isOutgoing
          ? lang('ActionStarGiftUnpack') : lang('ActionViewButton')}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, action }): Complete<StateProps> => {
    const currentUser = selectUser(global, global.currentUserId!);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);
    const messageSender = selectSender(global, message);
    const giftSender = action.fromId ? selectPeer(global, action.fromId) : undefined;
    const messageRecipient = message.isOutgoing ? selectPeer(global, message.chatId) : currentUser;
    const giftRecipientId = action.toId || action.peerId;
    const giftRecipient = giftRecipientId ? selectPeer(global, giftRecipientId) : undefined;

    return {
      canPlayAnimatedEmojis,
      sender: giftSender || messageSender,
      recipient: giftRecipient || messageRecipient,
      starGiftMaxConvertPeriod: global.appConfig.starGiftMaxConvertPeriod,
    };
  },
)(StarGiftAction));
