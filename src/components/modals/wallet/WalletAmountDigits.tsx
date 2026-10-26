import { memo, useLayoutEffect, useRef } from '../../../lib/teact/teact';

import type { AmountToken } from './helpers/amount';
import type { DigitCell } from './helpers/digits';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import buildClassName from '../../../util/buildClassName';
import { buildAmountTokens } from './helpers/amount';
import {
  FRACTION_CHARS, hitDigits, INTEGER_CHARS, measureWidths, replaceCells, startDigitsRoll, updateCells,
} from './helpers/digits';

import useEffectOnce from '../../../hooks/useEffectOnce';

import styles from './WalletAmountDigits.module.scss';

type OwnProps = {
  // With group commas
  integer: string;
  // With the leading point
  fraction: string;
  // A change of the key rolls the digits
  spinKey?: number;
  isSpinUp?: boolean;
  // A change of the key runs a hit through the digits, one after another
  hitKey?: number;
  noAnimation?: boolean;
  className?: string;
};

const WalletAmountDigits = ({
  integer, fraction, spinKey, isSpinUp, hitKey, noAnimation, className,
}: OwnProps) => {
  const cellsRef = useRef<HTMLSpanElement>();
  const measurerRef = useRef<HTMLSpanElement>();
  const stateRef = useRef<DigitCell[]>([]);
  const widthsRef = useRef<Map<string, number>>();
  const tokensRef = useRef<AmountToken[]>([]);
  const spinKeyRef = useRef(spinKey);
  const cancelRollRef = useRef<NoneToVoidFunction>();

  useEffectOnce(() => {
    function measure() {
      const measurer = measurerRef.current;
      if (measurer) widthsRef.current = measureWidths(measurer);
    }

    requestMeasure(measure);
    document.fonts?.ready.then(() => requestMeasure(measure));

    return () => {
      stateRef.current.forEach(({ filter }) => filter?.remove());
    };
  });

  useLayoutEffect(() => {
    const container = cellsRef.current!;
    const tokens = buildAmountTokens(integer, fraction);
    const fromTokens = tokensRef.current;
    const widths = widthsRef.current;
    const isSpin = spinKey !== spinKeyRef.current;
    tokensRef.current = tokens;
    spinKeyRef.current = spinKey;

    if (cancelRollRef.current) {
      cancelRollRef.current();
      cancelRollRef.current = undefined;
      stateRef.current = replaceCells(container, stateRef.current, fromTokens);
    }

    if (noAnimation || !widths) {
      stateRef.current = replaceCells(container, stateRef.current, tokens);
      return;
    }

    if (!isSpin) {
      stateRef.current = updateCells(container, widths, stateRef.current, tokens);
      return;
    }

    cancelRollRef.current = startDigitsRoll(container, fromTokens, tokens, Boolean(isSpinUp), () => {
      cancelRollRef.current = undefined;
      stateRef.current = replaceCells(container, stateRef.current, tokens);
    });
  }, [integer, fraction, spinKey, isSpinUp, noAnimation]);

  useLayoutEffect(() => {
    if (!hitKey || noAnimation) return;

    hitDigits(stateRef.current);
  }, [hitKey, noAnimation]);

  return (
    <span className={buildClassName(styles.root, className)} aria-hidden>
      <span ref={cellsRef} className={styles.cells} />
      <span ref={measurerRef} className={styles.measurer} aria-hidden>
        {Array.from(INTEGER_CHARS, (char) => <span key={char} className={styles.cell}>{char}</span>)}
        {Array.from(FRACTION_CHARS, (char) => (
          <span key={char} className={buildClassName(styles.cell, styles.fraction)}>{char}</span>
        ))}
      </span>
    </span>
  );
};

export default memo(WalletAmountDigits);
