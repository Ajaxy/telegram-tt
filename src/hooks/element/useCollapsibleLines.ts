import type {
  ElementRef } from '../../lib/teact/teact';
import {
  useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';

import { requestForcedReflow, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import calcTextLineHeightAndCount from '../../util/element/calcTextLineHeightAndCount';
import useDebouncedCallback from '../useDebouncedCallback';
import useLastCallback from '../useLastCallback';
import useWindowSize from '../window/useWindowSize';

const WINDOW_RESIZE_LINE_RECALC_DEBOUNCE = 200;

export default function useCollapsibleLines<T extends HTMLElement, C extends HTMLElement>(
  ref: ElementRef<T>,
  maxLinesBeforeCollapse: number,
  cutoutRef?: ElementRef<C>,
  isDisabled?: boolean,
) {
  const isFirstRenderRef = useRef(true);
  const cutoutHeightRef = useRef<number | undefined>();
  const fullHeightRef = useRef<number | undefined>();
  const [isCollapsible, setIsCollapsible] = useState(!isDisabled);
  const [isCollapsed, setIsCollapsed] = useState(isCollapsible);

  useLayoutEffect(() => {
    const element = (cutoutRef || ref).current;
    const shouldUseStyleInExpand = !cutoutRef;

    if (isDisabled || !element || isFirstRenderRef.current) return;

    requestMutation(() => {
      element.style.maxHeight = isCollapsed ? `${cutoutHeightRef.current}px` :
        shouldUseStyleInExpand ? `${fullHeightRef.current}px` : ``;
    });
  }, [cutoutRef, isCollapsed, isDisabled, ref]);

  const recalculateTextLines = useLastCallback(() => {
    if (isDisabled || !ref.current) {
      return;
    }
    const element = ref.current;

    const { lineHeight, totalLines } = calcTextLineHeightAndCount(element);
    fullHeightRef.current = element.scrollHeight;
    if (totalLines > maxLinesBeforeCollapse) {
      cutoutHeightRef.current = lineHeight * maxLinesBeforeCollapse;
      setIsCollapsible(true);
    } else {
      setIsCollapsible(false);
      setIsCollapsed(false);
    }
  });

  const debouncedRecalcTextLines = useDebouncedCallback(
    () => requestMeasure(recalculateTextLines),
    [recalculateTextLines],
    WINDOW_RESIZE_LINE_RECALC_DEBOUNCE,
  );

  useLayoutEffect(() => {
    if (!isDisabled && isFirstRenderRef.current) {
      requestForcedReflow(() => {
        recalculateTextLines();

        return () => {
          isFirstRenderRef.current = false;
          const element = (cutoutRef || ref).current;
          if (!element) return;
          element.style.maxHeight = cutoutHeightRef.current ?
            `${cutoutHeightRef.current}px` :
            `${fullHeightRef.current}px`;
        };
      });
    }
  }, [cutoutRef, isDisabled, recalculateTextLines, ref]);

  // Parent resize is triggered on every collapse/expand, so we do recalculation only on window resize to save resources
  const { width: windowWidth } = useWindowSize();
  useEffect(() => {
    if (!isDisabled) {
      if (isFirstRenderRef.current) return;

      debouncedRecalcTextLines();
    } else {
      setIsCollapsible(false);
      setIsCollapsed(false);
    }
  }, [debouncedRecalcTextLines, isDisabled, windowWidth]);

  return {
    isCollapsed,
    isCollapsible,
    setIsCollapsed,
  };
}
