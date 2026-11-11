import type { ElementRef } from '../../../lib/teact/teact';
import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiWalletCardSticker } from '../../../api/types';
import type { Size } from './helpers/cardStickers';
import type { StyleWaveSignal } from './useCardStyleWave';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectCanAnimateInterface } from '../../../global/selectors';
import { areArraysShallowEqual } from '../../../util/areShallowEqual';
import buildClassName from '../../../util/buildClassName';
import { formatTonInFiat } from '../../../util/formatCurrency';
import { splitAddressInHalves } from '../../../util/tonAddress';
import renderText from '../../common/helpers/renderText';
import { getFaceRect, scaleAmountRect } from './helpers/cardEditing';
import { getIsRectCovered } from './helpers/cardStickers';
import { buildStyleWaveStyles, getWalletCardStyle } from './helpers/cardStyleWave';
import { applyWalletCardTint, getWalletCardTint } from './helpers/cardTint';
import useCardTilt from './useCardTilt';

import useSelector from '../../../hooks/data/useSelector';
import useDerivedState from '../../../hooks/useDerivedState';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useShrinkToFit from '../../../hooks/useShrinkToFit';
import { useSignalEffect } from '../../../hooks/useSignalEffect';

import AnimatedCounter from '../../common/AnimatedCounter';
import Button from '../../ui/Button';
import ExpandableTonAmount from './ExpandableTonAmount';
import WalletCardDiamond from './WalletCardDiamond';
import WalletCardPattern from './WalletCardPattern';
import WalletCardStars from './WalletCardStars';
import WalletCardStickers from './WalletCardStickers';

import styles from './WalletCard.module.scss';

import QrIcon from '../../../assets/wallet-card-qr.svg';

// The labels that stand out from a sticker covering them
const EMPHASIZED_LABELS = ['amountContent', 'fiat', 'ownerName', 'address'] as const;

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
  backgroundAddress?: string;
  hiddenStickerAddresses?: string[];
  playingStickerAddress?: string;
  // The sticker editor measures the face and keeps it still while it works
  faceRef?: ElementRef<HTMLDivElement>;
  // The card the sticker limit shakes, with its edge
  foldRef?: ElementRef<HTMLDivElement>;
  isTiltDisabled?: boolean;
  // The wave of a color change, on the card the user decorates
  styleWave?: StyleWaveSignal;
  className?: string;
  onQrClick?: NoneToVoidFunction;
  onStickerPlayEnd?: NoneToVoidFunction;
};

const WalletCard = ({
  address, ownerName, balance, usdRate, currency, currencyRate, stickers, backgroundAddress, hiddenStickerAddresses,
  playingStickerAddress, faceRef, foldRef: externalFoldRef, isTiltDisabled, styleWave, className, onQrClick,
  onStickerPlayEnd,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const ownFoldRef = useRef<HTMLDivElement>();
  const foldRef = externalFoldRef ?? ownFoldRef;
  const ownFaceRef = useRef<HTMLDivElement>();
  const cardFaceRef = faceRef ?? ownFaceRef;
  const waveFaceRef = useRef<HTMLDivElement>();
  // The face size for a render in the middle of a wave
  const faceSizeRef = useRef<Size>();
  const balanceGlintRef = useRef<HTMLDivElement>();
  const amountRef = useRef<HTMLDivElement>();
  const amountContentRef = useRef<HTMLDivElement>();
  const addressRef = useRef<HTMLDivElement>();
  const qrButtonRef = useRef<HTMLButtonElement>();
  const qrPlateRef = useRef<HTMLDivElement>();
  const canAnimate = useSelector(selectCanAnimateInterface);
  const [isPressed, markPressed, unmarkPressed] = useFlag();
  const [coveredLabels, setCoveredLabels] = useState<string[]>([]);

  useCardTilt(ref, !canAnimate || isTiltDisabled);

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

  const cardStyle = useMemo(() => getWalletCardStyle(stickers, backgroundAddress), [stickers, backgroundAddress]);
  const { backdrop, pattern } = cardStyle || {};

  // `useCardTilt` writes to the same element, so the tint goes property by property
  useLayoutEffect(() => {
    applyWalletCardTint(ref.current!, backdrop && getWalletCardTint(backdrop.centerColor, backdrop.edgeColor));
  }, [backdrop]);

  // The card renders only when a wave comes or goes, and paints its frames itself
  const hasWave = useDerivedState(() => Boolean(styleWave?.()), [styleWave]);
  const waveFrom = useDerivedState(() => styleWave?.()?.from, [styleWave]);
  const currentWave = hasWave ? styleWave?.() : undefined;
  const waveStyles = currentWave
    && buildStyleWaveStyles(currentWave, faceSizeRef.current?.width ?? 0, faceSizeRef.current?.height ?? 0);

  useSignalEffect(() => {
    const wave = styleWave?.();
    if (!wave) {
      requestMutation(() => {
        if (foldRef.current) foldRef.current.style.cssText = '';
      });
      return;
    }

    const size = faceSizeRef.current;
    if (!size) return;

    const { fold, face } = buildStyleWaveStyles(wave, size.width, size.height);
    requestMutation(() => {
      if (foldRef.current) foldRef.current.style.cssText = fold;
      if (waveFaceRef.current) waveFaceRef.current.style.cssText = face;
    });
  }, [styleWave]);

  const measureCoveredLabels = useLastCallback(() => {
    requestMeasure(() => {
      const face = cardFaceRef.current;
      const shown = stickers?.filter(({ address: nftAddress }) => !hiddenStickerAddresses?.includes(nftAddress));
      const covered = face && shown?.length ? EMPHASIZED_LABELS.filter((name) => {
        const rect = measureLabelRect(name, face, {
          amountContent: amountContentRef.current, address: addressRef.current,
        });
        const card = { width: face.offsetWidth, height: face.offsetHeight };

        return rect && getIsRectCovered(rect, shown, card);
      }) : [];

      setCoveredLabels((current) => (areArraysShallowEqual(current, covered) ? current : covered));
    });
  });

  // Only a change of the stickers, the labels or the face size measures them again, never a frame of an animation
  useEffect(measureCoveredLabels, [
    measureCoveredLabels, stickers, hiddenStickerAddresses, balance, fiatAmount, ownerName,
  ]);

  useResizeObserver(cardFaceRef, ({ contentRect: { width, height } }) => {
    faceSizeRef.current = { width, height };
    measureCoveredLabels();
  });
  useResizeObserver(amountContentRef, measureCoveredLabels);

  function buildLabelClassName(name: LabelName) {
    return buildClassName(styles[name], coveredLabels.includes(name) && styles.emphasized);
  }

  const qrIcon = <img src={QrIcon} alt="" draggable={false} className={styles.qrIcon} />;

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        isPressed && styles.pressed,
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={unmarkPressed}
      onPointerCancel={unmarkPressed}
      onPointerLeave={unmarkPressed}
    >
      <div ref={foldRef} className={styles.fold} style={waveStyles?.fold}>
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
        <div ref={cardFaceRef} className={styles.card}>
          {waveStyles && <div ref={waveFaceRef} className={styles.waveFace} style={waveStyles.face} aria-hidden />}
          {(pattern || waveFrom?.pattern) && (
            <WalletCardPattern
              style={cardStyle}
              waveFrom={waveFrom}
              styleWave={styleWave}
              addressRef={addressRef}
              qrRef={onQrClick ? qrButtonRef : qrPlateRef}
            />
          )}
          <div className={styles.texture} aria-hidden />
          <WalletCardStars />
          <div className={styles.glare} aria-hidden />
          <div ref={balanceGlintRef} className={styles.balanceGlint} aria-hidden />
          {/* The amount, name, address and QR code come later, so the stickers stay under them */}
          {Boolean(stickers?.length) && (
            <WalletCardStickers
              stickers={stickers}
              hiddenAddresses={hiddenStickerAddresses}
              playingAddress={playingStickerAddress}
              onPlayEnd={onStickerPlayEnd}
            />
          )}
          <div ref={amountRef} className={styles.amount}>
            <div ref={amountContentRef} className={buildLabelClassName('amountContent')}>
              <WalletCardDiamond className={styles.diamond} />
              <ExpandableTonAmount
                nanos={balance ?? 0n}
                fractionClassName={styles.amountFraction}
                isAnimated
              />
              <span className={styles.ticker}>{lang('WalletCurrencyTicker')}</span>
            </div>
          </div>
          {fiatAmount && <AnimatedCounter text={fiatAmount} className={buildLabelClassName('fiat')} />}
          <div className={buildLabelClassName('ownerName')}>{ownerName && renderText(ownerName)}</div>
          <div ref={addressRef} className={buildLabelClassName('address')} aria-hidden>
            <div className={styles.addressRotator}>
              <span className={styles.addressLine}>{addressStart}</span>
              <span className={styles.addressLine}>{addressEnd}</span>
            </div>
          </div>
          {onQrClick ? (
            <Button
              ref={qrButtonRef}
              className={styles.qrButton}
              ariaLabel={lang('WalletShowAddress')}
              onClick={onQrClick}
            >
              {qrIcon}
            </Button>
          ) : (
            <div ref={qrPlateRef} className={buildClassName(styles.qrButton, styles.qrPlate)} aria-hidden>
              {qrIcon}
            </div>
          )}
          <div className={styles.innerShadow} aria-hidden />
        </div>
      </div>
    </div>
  );
};

export default memo(WalletCard);

type LabelName = typeof EMPHASIZED_LABELS[number];

type Labels = {
  amountContent?: HTMLElement;
  address?: HTMLElement;
};

function measureLabelRect(name: LabelName, face: HTMLElement, { amountContent, address }: Labels) {
  if (name === 'amountContent') return amountContent && measureAmountRect(amountContent, face);

  const label = name === 'address' ? address : face.querySelector<HTMLElement>(`.${styles[name]}`);

  return label && getFaceRect(label, face);
}

// As in the iOS app, the amount is its digits and ticker without the diamond
function measureAmountRect(content: HTMLElement, face: HTMLElement) {
  const rects = Array.from(content.children as HTMLCollectionOf<HTMLElement>)
    .filter((part) => !part.classList.contains(styles.diamond))
    .map((part) => getFaceRect(part, face));
  if (!rects.length) return undefined;

  return scaleAmountRect({
    left: Math.min(...rects.map(({ left }) => left)),
    right: Math.max(...rects.map(({ right }) => right)),
    top: Math.min(...rects.map(({ top }) => top)),
    bottom: Math.max(...rects.map(({ bottom }) => bottom)),
  }, content, face);
}
