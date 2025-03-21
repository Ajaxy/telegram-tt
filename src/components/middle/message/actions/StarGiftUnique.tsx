import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiMessage, ApiPeer } from '../../../../api/types';
import type { ApiMessageActionStarGiftUnique } from '../../../../api/types/messageActions';

import { getPeerTitle } from '../../../../global/helpers';
import {
  selectCanPlayAnimatedEmojis,
  selectPeer,
  selectSender,
  selectUser,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import { getGiftAttributes, getStickerFromGift } from '../../../common/helpers/gifts';
import { renderPeerLink } from '../helpers/messageActions';

import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import GiftRibbon from '../../../common/gift/GiftRibbon';
import MiniTable, { type TableEntry } from '../../../common/MiniTable';
import RadialPatternBackground from '../../../common/profile/RadialPatternBackground';
import Sparkles from '../../../common/Sparkles';
import StickerView from '../../../common/StickerView';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  message: ApiMessage;
  action: ApiMessageActionStarGiftUnique;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  canPlayAnimatedEmojis: boolean;
  sender?: ApiPeer;
  recipient?: ApiPeer;
};

const STICKER_SIZE = 120;

const StarGiftAction = ({
  action,
  message,
  canPlayAnimatedEmojis,
  sender,
  recipient,
  onClick,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  // eslint-disable-next-line no-null/no-null
  const stickerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const { isOutgoing } = message;

  const sticker = getStickerFromGift(action.gift)!;
  const attributes = getGiftAttributes(action.gift)!;
  const model = attributes.model!;
  const pattern = attributes.pattern!;
  const backdrop = attributes.backdrop!;
  const backgroundColors = [backdrop.centerColor, backdrop.edgeColor];
  const adaptedPatternColor = `${backdrop.patternColor.slice(0, 7)}55`;

  const tableData = useMemo((): TableEntry[] => [
    [lang('ActionStarGiftUniqueModel'), model.name],
    [lang('ActionStarGiftUniqueBackdrop'), backdrop.name],
    [lang('ActionStarGiftUniqueSymbol'), pattern.name],
  ], [lang, model, pattern, backdrop]);

  const shouldShowFrom = !isOutgoing || action.isUpgrade;
  const peer = shouldShowFrom && !action.isUpgrade ? sender : recipient;

  const fallbackPeerTitle = lang('ActionFallbackSomeone');
  const peerTitle = peer && getPeerTitle(lang, peer);
  const isSelf = sender?.id === recipient?.id;

  return (
    <div
      className={buildClassName(styles.contentBox, styles.starGift, styles.uniqueGift)}
      tabIndex={0}
      role="button"
      onClick={onClick}
    >
      <div className={styles.uniqueBackgroundWrapper}>
        <RadialPatternBackground
          className={styles.uniqueBackground}
          backgroundColors={backgroundColors}
          patternColor={backdrop.patternColor}
          patternIcon={pattern.sticker}
          clearBottomSector
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
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            noLoad={!canPlayAnimatedEmojis}
          />
        )}
      </div>
      <GiftRibbon
        color={adaptedPatternColor}
        text={lang('ActionStarGiftUniqueRibbon')}
      />
      <div className={styles.info}>
        <h3 className={styles.title}>
          {isSelf ? lang('ActionStarGiftSelf') : lang(
            shouldShowFrom ? 'ActionStarGiftFrom' : 'ActionStarGiftTo',
            {
              peer: renderPeerLink(peer?.id, peerTitle || fallbackPeerTitle),
            },
            {
              withNodes: true,
            },
          )}
        </h3>
        <div className={styles.subtitle} style={`color: ${backdrop.textColor}`}>
          {lang('GiftUnique', { title: action.gift.title, number: action.gift.number })}
        </div>
        <MiniTable data={tableData} style={`color: ${backdrop.textColor}`} valueClassName={styles.uniqueValue} />
      </div>
      <div
        className={styles.actionButton}
        style={buildStyle(adaptedPatternColor && `background-color: ${adaptedPatternColor}`)}
      >
        <Sparkles preset="button" />
        {lang('ActionViewButton')}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, action }): StateProps => {
    const currentUser = selectUser(global, global.currentUserId!);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);
    const messageSender = selectSender(global, message);
    const giftSender = action.fromId ? selectPeer(global, action.fromId) : undefined;
    const messageRecipient = message.isOutgoing ? selectPeer(global, message.chatId) : currentUser;
    const giftRecipient = action.peerId ? selectPeer(global, action.peerId) : undefined;

    return {
      canPlayAnimatedEmojis,
      sender: giftSender || messageSender,
      recipient: giftRecipient || messageRecipient,
    };
  },
)(StarGiftAction));
