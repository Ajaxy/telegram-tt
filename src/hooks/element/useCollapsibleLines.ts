import type {
  ElementRef, StateHookSetter } from '../../lib/teact/teact';
import {
  useEffect, useLayoutEffect, useRef, useState,
} from '../../lib/teact/teact';

import { requestForcedReflow, requestMeasure, requestMutation } from '../../lib/fasterdom/fasterdom';
import calcTextLineHeightAndCount from '../../util/element/calcTextLineHeightAndCount';
import useDebouncedCallback from '../useDebouncedCallback';
import useLastCallback from '../useLastCallback';
import useWindowSize from '../window/useWindowSize';

const WINDOW_RESIZE_LINE_RECALC_DEBOUNCE = 200;

type UseCollapsibleLinesOptions<C extends HTMLElement> = {
  cutoutRef?: ElementRef<C>;
  isDisabled?: boolean;
  noInitialCollapse?: boolean;
  recalculationKey?: unknown;
  isCollapsed?: boolean;
  onCollapseChange?: (isCollapsed: boolean) => void;
};

export default function useCollapsibleLines<T extends HTMLElement, C extends HTMLElement>(
  ref: ElementRef<T>,
  maxLinesBeforeCollapse: number,
  {
    cutoutRef,
    isDisabled,
    noInitialCollapse,
    recalculationKey,
    isCollapsed: isCollapsedControlled,
    onCollapseChange,
  }: UseCollapsibleLinesOptions<C> = {},
) {
  const isFirstRenderRef = useRef(true);
  const cutoutHeightRef = useRef<number | undefined>();
  const fullHeightRef = useRef<number | undefined>();
  const shouldInitiallyCollapse = isCollapsedControlled ?? !noInitialCollapse;
  const [isCollapsible, setIsCollapsible] = useState(!isDisabled && shouldInitiallyCollapse);
  const [isCollapsedUncontrolled, setIsCollapsedUncontrolled] = useState(isCollapsible);
  const isCollapsed = isCollapsedControlled ?? isCollapsedUncontrolled;
  const shouldKeepExpandedHeightAuto = recalculationKey !== undefined;

  const setIsCollapsed = useLastCallback<StateHookSetter<boolean>>((newValue) => {
    const isNextCollapsed = typeof newValue === 'function' ? newValue(isCollapsed) : newValue;
    if (isNextCollapsed === isCollapsed) return;

    if (isCollapsedControlled === undefined) {
      setIsCollapsedUncontrolled(isNextCollapsed);
    }
    onCollapseChange?.(isNextCollapsed);
  });

  useLayoutEffect(() => {
    const element = (cutoutRef || ref).current;
    const shouldUseStyleInExpand = !cutoutRef && !shouldKeepExpandedHeightAuto;

    if (!element || isFirstRenderRef.current) return;

    requestMutation(() => {
      if (isDisabled) {
        element.style.maxHeight = '';
        return;
      }

      element.style.maxHeight = isCollapsed ? `${cutoutHeightRef.current}px` :
        shouldUseStyleInExpand ? `${fullHeightRef.current}px` : ``;
    });
  }, [cutoutRef, isCollapsed, isDisabled, ref, shouldKeepExpandedHeightAuto]);

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
          element.style.maxHeight = isCollapsed && cutoutHeightRef.current ?
            `${cutoutHeightRef.current}px` :
            shouldKeepExpandedHeightAuto ? '' : `${fullHeightRef.current}px`;
        };
      });
    }
  }, [
    cutoutRef, isCollapsed, isDisabled, recalculateTextLines, ref, shouldKeepExpandedHeightAuto,
  ]);

  useEffect(() => {
    if (isDisabled || isFirstRenderRef.current || recalculationKey === undefined) return;

    requestMeasure(recalculateTextLines);
  }, [isDisabled, recalculateTextLines, recalculationKey]);

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
