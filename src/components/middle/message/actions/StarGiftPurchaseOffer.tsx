import { memo, useMemo, useRef } from '@teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionStarGiftPurchaseOffer } from '../../../../api/types/messageActions';

import { getPeerTitle } from '../../../../global/helpers/peers';
import {
  selectCanPlayAnimatedEmojis,
  selectPeer,
  selectSender,
  selectUser,
} from '../../../../global/selectors';
import { IS_TOUCH_ENV } from '../../../../util/browser/windowEnvironment';
import buildClassName from '../../../../util/buildClassName';
import { formatShortHoursMinutes } from '../../../../util/dates/dateFormat';
import { formatCurrencyAmountAsText } from '../../../../util/localization/format';
import { getServerTime } from '../../../../util/serverTime';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import { renderPeerLink } from '../helpers/messageActions';

import useIntervalForceUpdate from '../../../../hooks/schedulers/useIntervalForceUpdate';
import useFlag from '../../../../hooks/useFlag';
import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useOldLang from '../../../../hooks/useOldLang';

import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import StickerView from '../../../common/StickerView';

import actionStyles from '../ActionMessage.module.scss';
import styles from './StarGiftPurchaseOffer.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionStarGiftPurchaseOffer;
  hasButtons?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  canPlayAnimatedEmojis: boolean;
  sender?: ApiPeer;
  recipient?: ApiPeer;
};

const STICKER_SIZE = 48;
const ONE_MINUTE = 60 * 1000;

const StarGiftPurchaseOffer = ({
  action,
  message,
  hasButtons,
  canPlayAnimatedEmojis,
  sender,
  recipient,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onClick,
}: OwnProps & StateProps) => {
  const stickerRef = useRef<HTMLDivElement>();
  const lang = useLang();
  const oldLang = useOldLang();

  const [isHover, markHover, unmarkHover] = useFlag();

  const { isOutgoing } = message;

  const sticker = getStickerFromGift(action.gift);
  const attributes = getGiftAttributes(action.gift);
  const pattern = attributes?.pattern;
  const backdrop = attributes?.backdrop;

  const isActive = !action.isAccepted && !action.isDeclined;
  useIntervalForceUpdate(isActive ? ONE_MINUTE : undefined);

  const serverTime = getServerTime();
  const timeLeft = Math.max(0, action.expiresAt - serverTime);
  const formattedTime = formatShortHoursMinutes(oldLang, timeLeft);
  const hasExpired = timeLeft <= 0;

  const subtitle = useMemo(() => {
    if (action.isAccepted) return lang('ActionStarGiftOfferAccepted');
    if (action.isDeclined) return lang('ActionStarGiftOfferRejected');
    if (hasExpired) return lang('ActionStarGiftOfferHasExpired');
    return lang('ActionStarGiftOfferExpires', { time: formattedTime });
  }, [action.isAccepted, action.isDeclined, formattedTime, lang, hasExpired]);

  if (!sticker || !pattern || !backdrop) {
    return undefined;
  }

  const backgroundColors = [backdrop.centerColor, backdrop.edgeColor];

  const peer = isOutgoing ? recipient : sender;
  const fallbackPeerTitle = lang('ActionFallbackSomeone');
  const peerTitle = peer && getPeerTitle(lang, peer);

  const giftName = lang('GiftUnique', { title: action.gift.title, number: action.gift.number });
  const priceText = formatCurrencyAmountAsText(lang, action.price);

  return (
    <div
      className={buildClassName(
        actionStyles.contentBox,
        styles.root,
        hasButtons && styles.hasButtons,
        onClick && styles.clickable,
      )}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onMouseEnter={!IS_TOUCH_ENV ? markHover : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? unmarkHover : undefined}
      onClick={onClick}
    >
      <div className={styles.giftContainer}>
        <div className={styles.uniqueBackgroundWrapper}>
          <RadialPatternBackground
            className={styles.uniqueBackground}
            backgroundColors={backgroundColors}
            patternIcon={pattern.sticker}
            patternSize={9}
            ringsCount={1}
            ovalFactor={1}
          />
        </div>
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
      </div>
      <div className={styles.info}>
        <p className={styles.title}>
          {lang(
            isOutgoing ? 'ActionStarGiftOfferOutgoing' : 'ActionStarGiftOfferIncoming',
            {
              peer: renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle),
              cost: priceText,
              gift: giftName,
            },
            { withNodes: true, withMarkdown: true },
          )}
        </p>
        <p className={styles.subtitle}>
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message }): Complete<StateProps> => {
    const currentUser = selectUser(global, global.currentUserId!);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);
    const messageSender = selectSender(global, message);
    const messageRecipient = message.isOutgoing ? selectPeer(global, message.chatId) : currentUser;

    return {
      canPlayAnimatedEmojis,
      sender: messageSender,
      recipient: messageRecipient,
    };
  },
)(StarGiftPurchaseOffer));
