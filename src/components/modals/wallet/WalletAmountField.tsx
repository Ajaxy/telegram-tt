import {
  type ElementRef, memo, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import {
  formatTonInFiat, formatTonShortFromNanos, getCurrencyExp, parseTonToNanos,
} from '../../../util/formatCurrency';
import {
  convertFiatEntryToTon, convertTonToFiatEntry, DIGIT_REGEX, eraseAmountChar, getAmountGroupSeparator,
  getCurrencySymbol, POINT_KEYS, roundTonEntry, stripAmountGroupSeparators, TON_DECIMALS, typeAmountText,
} from './helpers/amount';
import {
  ARROW_DOWN_FRAMES, ARROW_UP_FRAMES, FLIP_DURATION, FLIP_FRAMES_TO_FIAT, FLIP_FRAMES_TO_GEM, POP_DURATION, POP_FRAMES,
  REFUSAL_DURATION_MS, REFUSAL_FRAMES, REFUSAL_VIBRATION,
} from './helpers/amountFrames';
import { SPIN_DURATION, splitNumberSegments } from './helpers/roll';
import { AMOUNT_DIAMOND_SIZE, AMOUNT_DIAMOND_SPIN } from './helpers/sendFlight';
import useAmountLaunch from './useAmountLaunch';
import useDiamondThrow from './useDiamondThrow';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShrinkToFit from '../../../hooks/useShrinkToFit';
import { useStateRef } from '../../../hooks/useStateRef';
import useUniqueId from '../../../hooks/useUniqueId';

import WalletAmountDigits from './WalletAmountDigits';
import WalletRollText from './WalletRollText';
import WalletStandaloneDiamond from './WalletStandaloneDiamond';

import styles from './WalletAmountField.module.scss';

export type AmountFieldControls = {
  shake: NoneToVoidFunction;
  // For an amount in fiat, switches the field to grams and returns the swap animation time and the amount in grams to
  // send. Returns `undefined` when the amount is already in grams.
  showGrams: () => { delay: number; amount: string } | undefined;
};

type OwnProps = {
  // In grams, also while the amount is typed in fiat
  amount: string;
  currency: string;
  usdRate?: number;
  currencyRate?: number;
  isActive: boolean;
  isSubmitted?: boolean;
  isLaunching?: boolean;
  noKeyCapture?: boolean;
  noCaret?: boolean;
  noAnimation?: boolean;
  diamondRef: ElementRef<StandaloneDiamond>;
  controlsRef: ElementRef<AmountFieldControls>;
  onAmountChange: (amount: string) => void;
  onSubmit: NoneToVoidFunction;
};

const NAVIGATION_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const INTEGER_GROUP_REGEX = /\d(?=(\d{3})+$)/g;
const DRAG_SELECT_DISTANCE = 4;
// A finger shakes more than a mouse, and a tap must not select the amount
const TOUCH_DRAG_SELECT_DISTANCE = 15;
// Roll steps of the currency code and of the pill, eight tenths of their cap height
const CODE_PITCH = 18.2;
const PILL_PITCH = 7.4;
const SUBMIT_AFTER_SWAP_DELAY = SPIN_DURATION + 80;
// The salute spreads over the whole canvas, so its size sets how far the stars fly
const GEM_CANVAS_SIZE = 220;
const AMOUNT_BURST_SIZE = 0.25;
const DIGIT_KICK = -5.5;
const DIGIT_KICK_STEP = -0.25;
const POINT_KICK = -3.5;
const ERASE_KICK = 6.5;
const SWAP_KICK = 9;
const SWAP_KICK_DECAY = 0.8;

const WalletAmountField = ({
  amount, currency, usdRate, currencyRate, isActive, isSubmitted, isLaunching, noKeyCapture, noCaret, noAnimation,
  diamondRef, controlsRef, onAmountChange, onSubmit,
}: OwnProps) => {
  const lang = useLang();
  const currencyLabelId = useUniqueId();

  const amountBlockRef = useRef<HTMLDivElement>();
  const lineRef = useRef<HTMLDivElement>();
  const gemFaceRef = useRef<HTMLSpanElement>();
  const amountSymbolRef = useRef<HTMLSpanElement>();
  const signRef = useRef<HTMLSpanElement>();
  const arrowUpRef = useRef<SVGGElement>();
  const arrowDownRef = useRef<SVGGElement>();
  const inputRef = useRef<HTMLInputElement>();
  const dragStartXRef = useRef<number>();
  const hasDragSelectedRef = useRef(false);
  const [isAmountFocused, markAmountFocused, unmarkAmountFocused] = useFlag();
  // Remounts the caret, so it starts lit after every change
  const [caretKey, setCaretKey] = useState(0);

  // In fiat the typed amount is kept as typed, and the grams of the draft follow it
  const [isFiatEntry, setIsFiatEntry] = useState(false);
  const isFiatEntryRef = useStateRef(isFiatEntry);
  const [fiatEntry, setFiatEntry] = useState('');
  const fiatTonAmountRef = useRef<string>();
  // A converted amount is rounded, so the next key starts a new one
  const isConvertedRef = useRef(false);
  const [spin, setSpin] = useState({ key: 0, isUp: true });
  // The diamond is turned away in fiat, so it rests once the flip is over
  const [isGemFlipping, markGemFlipping, unmarkGemFlipping] = useFlag();
  const gemFlipRef = useRef<Animation>();
  // Only the 3D diamond can be turned, so the drag handle waits for it
  const [isGemReady, setIsGemReady] = useState(false);
  const entry = isFiatEntry ? fiatEntry : amount;

  // Keys can come faster than renders, so each one builds on the amount the previous one set
  const entryRef = useStateRef(entry);
  // The amount as it was when selected, so any change of the amount drops the selection
  const [selectedAmount, setSelectedAmount] = useState<string>();
  const selectedAmountRef = useStateRef(selectedAmount);
  const isAmountSelected = Boolean(selectedAmount) && selectedAmount === entry;
  const fiatRate = usdRate !== undefined && currencyRate !== undefined ? usdRate * currencyRate : undefined;
  const fiatDecimals = getCurrencyExp(currency);
  const amountNanos = parseTonToNanos(amount);

  const { glowRef, ringRef, hitKey } = useAmountLaunch(diamondRef, isLaunching, isActive);
  const gemThrow = useDiamondThrow(diamondRef);

  useShrinkToFit(amountBlockRef, lineRef);

  // A tap on touch screens brings the keyboard up by itself, and a focus from here would not
  useEffect(() => {
    if (!isActive || IS_TOUCH_ENV) return;

    inputRef.current?.focus({ preventScroll: true });
  }, [isActive]);

  const shake = useLastCallback(() => {
    if (noAnimation) return;

    requestMutation(() => {
      lineRef.current?.animate(REFUSAL_FRAMES, { duration: REFUSAL_DURATION_MS });
    });
  });

  const refuse = useLastCallback(() => {
    navigator.vibrate?.(REFUSAL_VIBRATION);
    shake();
  });

  const showGrams = useLastCallback(() => {
    if (!isFiatEntryRef.current) return undefined;

    handleSwapCurrency();

    return { delay: noAnimation ? 0 : SUBMIT_AFTER_SWAP_DELAY, amount: entryRef.current };
  });

  useEffect(() => {
    controlsRef.current = { shake, showGrams };

    return () => {
      controlsRef.current = undefined;
    };
  }, [controlsRef, shake, showGrams]);

  // Leaves fiat mode when the balance button sets an amount in grams, which the fiat field cannot show, or when there
  // is no rate to convert with. A new rate converts the typed fiat amount to grams again, because grams always follow
  // the fiat amount.
  useEffectWithPrevDeps(([, prevFiatRate]) => {
    if (!isFiatEntryRef.current) return;

    if (!fiatRate || amount !== fiatTonAmountRef.current) {
      isFiatEntryRef.current = false;
      setIsFiatEntry(false);
      return;
    }

    if (fiatRate === prevFiatRate || isSubmitted) return;

    const tonAmount = convertFiatEntryToTon(entryRef.current, fiatRate);
    fiatTonAmountRef.current = tonAmount;
    onAmountChange(tonAmount);
  }, [amount, fiatRate, isFiatEntryRef, entryRef, isSubmitted, onAmountChange]);

  const handleSwapCurrency = useLastCallback(() => {
    if (!fiatRate || isSubmitted) return;

    const isToFiat = !isFiatEntryRef.current;
    const next = isToFiat ? convertTonToFiatEntry(amountNanos, fiatRate, fiatDecimals)
      : isConvertedRef.current ? amount : roundTonEntry(amountNanos);
    const isUp = Number(next) >= Number(entryRef.current);

    unselectAmount();
    isFiatEntryRef.current = isToFiat;
    setIsFiatEntry(isToFiat);
    entryRef.current = next;
    if (isToFiat) {
      fiatTonAmountRef.current = amount;
      setFiatEntry(next);
    } else {
      onAmountChange(next);
    }
    isConvertedRef.current = true;
    setSpin(({ key }) => ({ key: key + 1, isUp }));
    diamondRef.current?.kick(isUp ? -SWAP_KICK : SWAP_KICK, SWAP_KICK_DECAY);

    if (noAnimation) return;

    markGemFlipping();

    requestMutation(() => {
      const flipFrames = isToFiat ? FLIP_FRAMES_TO_FIAT : FLIP_FRAMES_TO_GEM;
      const gemFlip = gemFaceRef.current!.animate(flipFrames.gem, FLIP_DURATION);
      gemFlipRef.current = gemFlip;

      gemFlip.finished.then(() => {
        if (gemFlipRef.current === gemFlip) unmarkGemFlipping();
      }, () => undefined);

      signRef.current?.animate(flipFrames.sign, FLIP_DURATION);
      arrowUpRef.current?.animate(ARROW_UP_FRAMES, SPIN_DURATION);
      arrowDownRef.current?.animate(ARROW_DOWN_FRAMES, SPIN_DURATION);
    });
  });

  const typeAmount = useLastCallback((text: string, isReplacing?: boolean) => {
    const decimals = isFiatEntryRef.current ? fiatDecimals : TON_DECIMALS;
    const base = isReplacing || getIsAmountSelected() || isConvertedRef.current ? '' : entryRef.current;
    const next = typeAmountText(base, text, decimals, (char) => {
      diamondRef.current?.kick(DIGIT_REGEX.test(char) ? DIGIT_KICK + DIGIT_KICK_STEP * Number(char) : POINT_KICK);
    });

    if (next === undefined) {
      refuse();
      return;
    }

    setEntry(next);
  });

  const eraseAmount = useLastCallback(() => {
    if (getIsAmountSelected()) {
      setEntry('');
      return;
    }

    const next = eraseAmountChar(entryRef.current);
    if (next === undefined) {
      refuse();
      return;
    }

    setEntry(next);
  });

  const setEntry = useLastCallback((next: string) => {
    unselectAmount();
    isConvertedRef.current = false;
    if (next === entryRef.current) return;

    if (next.length < entryRef.current.length) diamondRef.current?.kick(ERASE_KICK);
    if (!noAnimation) {
      requestMutation(() => {
        amountSymbolRef.current?.animate(POP_FRAMES, POP_DURATION);
      });
    }
    entryRef.current = next;
    if (isFiatEntryRef.current) {
      const tonAmount = convertFiatEntryToTon(next, fiatRate!);
      fiatTonAmountRef.current = tonAmount;
      setFiatEntry(next);
      onAmountChange(tonAmount);
    } else {
      onAmountChange(next);
    }
    setCaretKey((key) => key + 1);
  });

  // The field holds the amount for screen readers and soft keyboards, and its edits go through the typing rules
  const handleAmountInput = useLastCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const current = entryRef.current;
    // An input method may give full-width digits and points
    const value = input.value.normalize('NFKC');
    // A pasted `1,000` is a thousand only when both the app and the browser languages write it so
    const groupSeparator = getAmountGroupSeparator([lang.code, navigator.language]);

    if (value.startsWith(current)) {
      typeAmount(stripAmountGroupSeparators(value.slice(current.length), groupSeparator));
    } else if (current.startsWith(value)) {
      setEntry(value);
    } else {
      typeAmount(stripAmountGroupSeparators(value, groupSeparator), true);
    }

    // A refused character leaves the amount as it was
    input.value = entryRef.current;
  });

  const selectAmount = useLastCallback(() => {
    selectedAmountRef.current = entryRef.current;
    setSelectedAmount(entryRef.current);
  });

  const unselectAmount = useLastCallback(() => {
    selectedAmountRef.current = undefined;
    setSelectedAmount(undefined);
  });

  const getIsAmountSelected = useLastCallback(() => (
    Boolean(selectedAmountRef.current) && selectedAmountRef.current === entryRef.current
  ));

  const handleAmountKeyDown = useLastCallback((e: KeyboardEvent | React.KeyboardEvent) => {
    const isCommand = e.metaKey || e.ctrlKey;
    const isSelected = getIsAmountSelected();

    if (isCommand && e.code === 'KeyA') {
      selectAmount();
    } else if (isCommand && isSelected && (e.code === 'KeyC' || e.code === 'KeyX')) {
      copyTextToClipboard(entryRef.current);
      if (e.code === 'KeyX') setEntry('');
    } else if (e.key === 'Backspace' || (e.key === 'Delete' && isSelected)) {
      eraseAmount();
    } else if (e.key === 'Enter' && !e.isComposing) {
      onSubmit();
    } else if (NAVIGATION_KEYS.has(e.key)) {
      unselectAmount();
      // The field's own caret stays at the end, where the typed characters go
      if (e.target !== inputRef.current) return;
    } else {
      return;
    }

    e.preventDefault();
  });

  useEffect(() => {
    if (!isActive || isSubmitted || noKeyCapture) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || getIsEditable(e.target)) return;
      if (e.key === 'Enter' && e.target instanceof Element && e.target.closest('button, a')) return;

      if (!e.metaKey && !e.ctrlKey && (DIGIT_REGEX.test(e.key) || POINT_KEYS.has(e.key))) {
        e.preventDefault();
        typeAmount(e.key);
      } else {
        handleAmountKeyDown(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isSubmitted, noKeyCapture]);

  const handleLineClick = useLastCallback(() => {
    dragStartXRef.current = undefined;
    if (hasDragSelectedRef.current) {
      hasDragSelectedRef.current = false;
    } else {
      unselectAmount();
    }

    inputRef.current?.focus({ preventScroll: true });
  });

  // The field lies over the amount, and a click would place its caret in the middle of the typed characters
  const handleAmountMouseDown = useLastCallback((e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
  });

  const handleLinePointerDown = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragStartXRef.current = e.clientX;
  });

  // The amount is edited only at its end, so a drag selects all of it
  const handleLinePointerMove = useLastCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const startX = dragStartXRef.current;
    const distance = e.pointerType === 'touch' ? TOUCH_DRAG_SELECT_DISTANCE : DRAG_SELECT_DISTANCE;
    if (startX === undefined || !e.buttons || Math.abs(e.clientX - startX) < distance) return;

    dragStartXRef.current = undefined;
    hasDragSelectedRef.current = true;
    selectAmount();
  });

  const handleAmountBlur = useLastCallback(() => {
    unmarkAmountFocused();
    unselectAmount();
  });

  const fiatHint = formatTonInFiat(amountNanos, usdRate, currency, currencyRate, lang.code);
  const pillText = isFiatEntry ? `${formatTonShortFromNanos(amountNanos)} ${lang('WalletCurrencyTicker')}`
    : fiatHint && `~${fiatHint}`;
  const pillSegments = useMemo(() => (pillText ? splitNumberSegments(pillText) : undefined), [pillText]);
  const currencyCode = isFiatEntry ? currency : lang('WalletCurrencyTicker');
  const currencySymbol = useMemo(() => getCurrencySymbol(currency, lang.code), [currency, lang.code]);
  const isCurrencySymbolWide = Boolean(currencySymbol && Array.from(currencySymbol).length > 1);
  const currencySegments = useMemo(() => [{ text: currencyCode, hasStagger: true }], [currencyCode]);

  const [integer, fraction] = entry.split('.');
  // The caret shows where the keys go, and on touch screens only from the amount field
  const isCaretShown = !isAmountSelected && !noCaret && (isAmountFocused || !IS_TOUCH_ENV);

  return (
    <div
      ref={amountBlockRef}
      className={buildClassName(styles.root, isLaunching && styles.launching)}
      inert={isSubmitted}
    >
      <div
        ref={lineRef}
        className={buildClassName(
          styles.line,
          isFiatEntry && styles.lineFiat,
          isAmountSelected && styles.lineSelected,
        )}
        onClick={handleLineClick}
        onDoubleClick={selectAmount}
        onPointerDown={handleLinePointerDown}
        onPointerMove={handleLinePointerMove}
      >
        <span ref={amountSymbolRef} className={styles.symbol}>
          <span ref={glowRef} className={styles.glow} />
          <span ref={ringRef} className={styles.ring} />
          {isGemReady && !isFiatEntry && !isSubmitted && (
            <span
              className={styles.gemHandle}
              onPointerDown={gemThrow.handlePointerDown}
              onPointerMove={gemThrow.handlePointerMove}
              onPointerUp={gemThrow.handlePointerUp}
              onPointerCancel={gemThrow.handlePointerUp}
            />
          )}
          <span ref={gemFaceRef} className={styles.gemFace}>
            <WalletStandaloneDiamond
              diamondRef={diamondRef}
              size={AMOUNT_DIAMOND_SIZE}
              canvasSize={GEM_CANVAS_SIZE}
              speed={AMOUNT_DIAMOND_SPIN}
              burstSize={AMOUNT_BURST_SIZE}
              isPaused={isFiatEntry && !isGemFlipping}
              onReadyChange={setIsGemReady}
            />
          </span>
          <span ref={signRef} className={buildClassName(styles.sign, isCurrencySymbolWide && styles.signWide)}>
            {currencySymbol}
          </span>
        </span>
        <WalletAmountDigits
          integer={(integer || '0').replace(INTEGER_GROUP_REGEX, '$&,')}
          fraction={fraction !== undefined ? `.${fraction}` : ''}
          spinKey={spin.key}
          isSpinUp={spin.isUp}
          hitKey={hitKey}
          noAnimation={noAnimation}
          className={styles.digits}
        />
        <span key={caretKey} className={buildClassName(styles.caret, !isCaretShown && styles.caretHidden)} />
        <WalletRollText
          segments={currencySegments}
          pitch={CODE_PITCH}
          spinKey={spin.key}
          isSpinUp={spin.isUp}
          noAnimation={noAnimation}
          className={styles.code}
        />
        <span id={currencyLabelId} className="visually-hidden">{currencyCode}</span>
        <input
          ref={inputRef}
          className={styles.input}
          inputMode="decimal"
          autoComplete="off"
          value={entry}
          aria-label={lang('WalletSendAmount')}
          aria-describedby={currencyLabelId}
          onMouseDown={handleAmountMouseDown}
          onChange={handleAmountInput}
          onKeyDown={handleAmountKeyDown}
          onFocus={markAmountFocused}
          onBlur={handleAmountBlur}
        />
      </div>
      {pillText && (
        <button
          type="button"
          className={styles.fiat}
          disabled={!fiatRate || isSubmitted}
          aria-label={`${pillText}, ${lang('WalletSendSwitchCurrency')}`}
          onClick={handleSwapCurrency}
        >
          <WalletRollText
            segments={pillSegments!}
            pitch={PILL_PITCH}
            spinKey={spin.key}
            isSpinUp={spin.isUp}
            noAnimation={noAnimation}
          />
          {Boolean(fiatRate) && (
            <svg className={styles.fiatArrows} viewBox="0 0 18 18" aria-hidden>
              <g ref={arrowUpRef} className={styles.fiatArrowUp}>
                <path d="M5.57 13.5V5.5M3 8.07l2.57-2.57 2.57 2.57" />
              </g>
              <g ref={arrowDownRef} className={styles.fiatArrowDown}>
                <path d="M12.43 5.5v8M9.86 10.93l2.57 2.57L15 10.93" />
              </g>
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

function getIsEditable(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

export default memo(WalletAmountField);
