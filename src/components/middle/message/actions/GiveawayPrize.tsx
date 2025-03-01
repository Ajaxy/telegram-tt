import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiChat, ApiSticker } from '../../../../api/types';
import type { ApiMessageActionGiftCode, ApiMessageActionPrizeStars } from '../../../../api/types/messageActions';

import { getPeerTitle } from '../../../../global/helpers';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectGiftStickerForDuration,
  selectGiftStickerForStars,
} from '../../../../global/selectors';
import { renderPeerLink } from '../helpers/messageActions';

import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import Sparkles from '../../../common/Sparkles';
import StickerView from '../../../common/StickerView';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  action: ApiMessageActionGiftCode | ApiMessageActionPrizeStars;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  channel?: ApiChat;
  sticker?: ApiSticker;
  canPlayAnimatedEmojis: boolean;
};

const STICKER_SIZE = 150;

const GiveawayPrizeAction = ({
  action,
  sticker,
  canPlayAnimatedEmojis,
  channel,
  onClick,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  // eslint-disable-next-line no-null/no-null
  const stickerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const channelLink = useMemo(() => {
    const channelTitle = channel && getPeerTitle(lang, channel);
    const channelFallbackText = lang('ActionFallbackChannel');

    return renderPeerLink(channel?.id, channelTitle || channelFallbackText);
  }, [channel, lang]);

  return (
    <div className={styles.contentBox} tabIndex={0} role="button" onClick={onClick}>
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
      <div>
        <h3 className={styles.title}>{lang('ActionGiveawayResultTitle')}</h3>
        <div>
          {action.type === 'giftCode' && (
            lang(
              action.isViaGiveaway ? 'ActionGiveawayResultPremiumText' : 'ActionGiftCodePremiumText',
              { months: action.months, channel: channelLink },
              {
                withNodes: true,
                withMarkdown: true,
                pluralValue: action.months,
                renderTextFilters: ['br'],
              },
            )
          )}
          {action.type === 'prizeStars' && (
            lang(
              'ActionGiveawayResultStarsText',
              { amount: action.stars, channel: channelLink },
              {
                withNodes: true,
                withMarkdown: true,
                pluralValue: action.stars,
                renderTextFilters: ['br'],
              },
            )
          )}
        </div>
      </div>
      <div className={styles.actionButton}>
        <Sparkles preset="button" />
        {lang(action.type === 'giftCode' ? 'ActionOpenGiftButton' : 'ActionViewButton')}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { action }): StateProps => {
    const sticker = action.type === 'giftCode'
      ? selectGiftStickerForDuration(global, action.months)
      : selectGiftStickerForStars(global, action.stars);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);

    const channel = selectChat(global, action.boostPeerId!);

    return {
      sticker,
      canPlayAnimatedEmojis,
      channel,
    };
  },
)(GiveawayPrizeAction));
