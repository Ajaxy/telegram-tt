import { memo, useMemo, useRef } from '../../../lib/teact/teact';

import type { ApiStarGiftUnique, ApiWalletCardSticker } from '../../../api/types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatTonInFiat } from '../../../util/formatCurrency';
import { splitAddressInHalves } from '../../../util/tonAddress';
import { getGiftAttributes } from '../../common/helpers/gifts';
import renderText from '../../common/helpers/renderText';
import useCardTilt from './useCardTilt';

import useSelector from '../../../hooks/data/useSelector';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShrinkToFit from '../../../hooks/useShrinkToFit';

import AnimatedCounter from '../../common/AnimatedCounter';
import RadialPatternBackground from '../../common/profile/RadialPatternBackground';
import Button from '../../ui/Button';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletCardDiamond from './WalletCardDiamond';
import WalletCardStars from './WalletCardStars';
import WalletCardStickers from './WalletCardStickers';

import styles from './WalletCard.module.scss';

import QrIcon from '../../../assets/wallet-card-qr.svg';

// One layer per pixel of the edge, so it reads as solid at any angle
const EDGE_LAYERS = [1, 2, 3, 4, 5];
const BALANCE_GLINT_KEYFRAMES = [{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }];
const BALANCE_GLINT_OPTIONS = { duration: 1100, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' };

type OwnProps = {
  address: string;
  ownerName?: string;
  balance?: bigint;
  usdRate?: number;
  currency: string;
  currencyRate?: number;
  stickers?: ApiWalletCardSticker[];
  backgroundGift?: ApiStarGiftUnique;
  className?: string;
  onQrClick?: NoneToVoidFunction;
};

const WalletCard = ({
  address, ownerName, balance, usdRate, currency, currencyRate, stickers, backgroundGift, className, onQrClick,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const balanceGlintRef = useRef<HTMLDivElement>();
  const amountRef = useRef<HTMLDivElement>();
  const amountContentRef = useRef<HTMLDivElement>();
  const canAnimate = useSelector(selectCanAnimateInterface);
  const [isPressed, markPressed, unmarkPressed] = useFlag();

  useCardTilt(ref, !canAnimate);

  useShrinkToFit(amountRef, amountContentRef);

  useEffectWithPrevDeps(([prevBalance]) => {
    if (prevBalance === undefined || balance === undefined || balance === prevBalance) return;
    if (!canAnimate || document.hidden) return;

    requestMutation(() => {
      balanceGlintRef.current?.animate(BALANCE_GLINT_KEYFRAMES, BALANCE_GLINT_OPTIONS);
    });
  }, [balance, canAnimate]);

  const handlePointerDown = useLastCallback((e: React.PointerEvent) => {
    if (e.button === 0 && canAnimate) markPressed();
  });

  const [addressStart, addressEnd] = splitAddressInHalves(address);

  const fiatAmount = balance !== undefined && formatTonInFiat(balance, usdRate, currency, currencyRate, lang.code, {
    shouldOmitFractions: true,
  });

  const { backdrop, pattern } = (backgroundGift && getGiftAttributes(backgroundGift)) || {};
  const backdropColors = useMemo(() => backdrop && [backdrop.centerColor, backdrop.edgeColor], [backdrop]);

  const qrIcon = <img src={QrIcon} alt="" draggable={false} className={styles.qrIcon} />;

  return (
    <div
      ref={ref}
      className={buildClassName(styles.root, isPressed && styles.pressed, backdrop && styles.withBackdrop, className)}
      style={backdrop && `--card-edge-color: ${backdrop.edgeColor}; --card-accent-color: ${backdrop.textColor}`}
      onPointerDown={handlePointerDown}
      onPointerUp={unmarkPressed}
      onPointerCancel={unmarkPressed}
      onPointerLeave={unmarkPressed}
    >
      <div className={styles.fold}>
        {EDGE_LAYERS.map((layer) => (
          <div
            key={layer}
            className={buildClassName(
              styles.edgeLayer,
              layer === 1 && styles.edgeRim,
              layer === EDGE_LAYERS.length && styles.edgeShadow,
            )}
            style={`--layer: ${layer}`}
            aria-hidden
          />
        ))}
        <div className={styles.card}>
          {backdrop && (
            <RadialPatternBackground
              className={styles.backdrop}
              backgroundColors={backdropColors}
              patternColor={backdrop.patternColor}
              patternIcon={pattern?.sticker}
              withAdaptiveHeight
            />
          )}
          <div className={styles.texture} aria-hidden />
          <WalletCardStars />
          <div className={styles.glare} aria-hidden />
          <div ref={balanceGlintRef} className={styles.balanceGlint} aria-hidden />
          {/* The amount, name, address and QR code come later, so the stickers stay under them */}
          {Boolean(stickers?.length) && <WalletCardStickers stickers={stickers} />}
          <div ref={amountRef} className={styles.amount}>
            <div ref={amountContentRef} className={styles.amountContent}>
              <WalletCardDiamond className={styles.diamond} />
              <ExpandableTonAmount
                nanos={balance ?? 0n}
                fractionClassName={styles.amountFraction}
                isAnimated
              />
              <span className={styles.ticker}>{lang('WalletCurrencyTicker')}</span>
            </div>
          </div>
          {fiatAmount && <AnimatedCounter text={fiatAmount} className={styles.fiat} />}
          <div className={styles.ownerName}>{ownerName && renderText(ownerName)}</div>
          <div className={styles.address} aria-hidden>
            <div className={styles.addressRotator}>
              <span className={styles.addressLine}>{addressStart}</span>
              <span className={styles.addressLine}>{addressEnd}</span>
            </div>
          </div>
          {onQrClick ? (
            <Button
              className={styles.qrButton}
              ariaLabel={lang('WalletShowAddress')}
              onClick={onQrClick}
            >
              {qrIcon}
            </Button>
          ) : (
            <div className={buildClassName(styles.qrButton, styles.qrPlate)} aria-hidden>{qrIcon}</div>
          )}
          <div className={styles.innerShadow} aria-hidden />
        </div>
      </div>
    </div>
  );
};

export default memo(WalletCard);
