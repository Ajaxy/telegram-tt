import { memo, useRef } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type {
  ApiMessageActionGiftPremium,
  ApiMessageActionGiftStars,
  ApiMessageActionGiftTon } from '../../../../api/types/messageActions';

import {
  selectCanPlayAnimatedEmojis,
  selectGiftStickerForDuration,
  selectGiftStickerForStars,
  selectGiftStickerForTon,
} from '../../../../global/selectors';
import { formatCountdownDays } from '../../../../util/dates/dateFormat';
import { formatCurrency } from '../../../../util/formatCurrency';
import { renderTextWithEntities } from '../../../common/helpers/renderTextWithEntities';

import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import Sparkles from '../../../common/Sparkles';
import StickerView from '../../../common/StickerView';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  action: ApiMessageActionGiftPremium | ApiMessageActionGiftStars | ApiMessageActionGiftTon;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

type StateProps = {
  sticker?: ApiSticker;
  canPlayAnimatedEmojis: boolean;
};

const STICKER_SIZE = 150;

const GiftAction = ({
  action,
  sticker,
  canPlayAnimatedEmojis,
  onClick,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  const stickerRef = useRef<HTMLDivElement>();
  const lang = useLang();
  const message = action.type === 'giftPremium' ? action.message : undefined;

  const renderTonTitle = () => {
    const { cryptoAmount, cryptoCurrency } = action;
    const price = cryptoAmount
      ? formatCurrency(lang, cryptoAmount, cryptoCurrency!, { asFontIcon: true })
      : undefined;

    return price;
  };

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
      <div className={styles.info}>
        <h3 className={styles.title}>
          {action.type === 'giftPremium' ? (
            lang('ActionGiftPremiumDuration', { duration: formatCountdownDays(lang, action.days) })
          ) : action.type === 'giftStars' ? (
            lang('ActionGiftStarsTitle', { amount: action.stars }, { pluralValue: action.stars })
          ) : renderTonTitle()}
        </h3>
        <div>
          {message && renderTextWithEntities(message)}
          {!message
            && (lang(action.type === 'giftTon' ? 'DescriptionAboutTon'
              : action.type === 'giftPremium'
                ? 'ActionGiftPremiumText' : 'ActionGiftStarsText'))}
        </div>
      </div>
      <div className={styles.actionButton}>
        <Sparkles preset="button" />
        {lang('ActionViewButton')}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { action }): Complete<StateProps> => {
    const sticker = action.type === 'giftPremium'
      ? selectGiftStickerForDuration(global, action.days)
      : action.type === 'giftStars'
        ? selectGiftStickerForStars(global, action.stars)
        : selectGiftStickerForTon(global, action.cryptoAmount);
    const canPlayAnimatedEmojis = selectCanPlayAnimatedEmojis(global);

    return {
      sticker,
      canPlayAnimatedEmojis,
    };
  },
)(GiftAction));
