import type { ElementRef } from '../lib/teact/teact';
import { useLayoutEffect } from '../lib/teact/teact';
import { addExtraClass, removeExtraClass, setExtraStyles } from '../lib/teact/teact-dom';

import type { IAnchorPosition } from '../types';

import { requestForcedReflow } from '../lib/fasterdom/fasterdom';
import { useStateRef } from './useStateRef';

interface StaticPositionOptions {
  anchor?: IAnchorPosition;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  transformOriginX?: number;
  transformOriginY?: number;
  style?: string;
  bubbleStyle?: string;
}

interface DynamicPositionOptions {
  anchor: IAnchorPosition;
  getTriggerElement: () => HTMLElement | undefined | null;
  getRootElement: () => HTMLElement | undefined | null;
  getMenuElement: () => HTMLElement | undefined | null;
  getLayout?: () => Layout;
  withMaxHeight?: boolean;
}

export type MenuPositionOptions =
  StaticPositionOptions
  | DynamicPositionOptions;

export interface Layout {
  extraPaddingX?: number;
  extraTopPadding?: number;
  menuElMinWidth?: number;
  deltaX?: number;
  topShiftY?: number;
  shouldAvoidNegativePosition?: boolean;
  withPortal?: boolean;
  isDense?: boolean; //  Allows you to place the menu as close to the edges of the area as possible
}

const MENU_POSITION_VISUAL_COMFORT_SPACE_PX = 16;
const MENU_POSITION_BOTTOM_MARGIN = 12;
const EMPTY_RECT = {
  width: 0, left: 0, height: 0, top: 0,
};

export default function useMenuPosition(
  isOpen: boolean,
  containerRef: ElementRef<HTMLDivElement>,
  bubbleRef: ElementRef<HTMLDivElement>,
  options: MenuPositionOptions,
) {
  const optionsRef = useStateRef(options);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const options2 = optionsRef.current;

    if (!('getTriggerElement' in options2)) {
      applyStaticOptions(containerRef, bubbleRef, options2);
    } else {
      requestForcedReflow(() => {
        const staticOptions = processDynamically(containerRef, bubbleRef, options2);

        return () => {
          applyStaticOptions(containerRef, bubbleRef, staticOptions);
        };
      });
    }
  }, [isOpen, containerRef, bubbleRef, optionsRef]);
}

function applyStaticOptions(
  containerRef: ElementRef<HTMLDivElement>,
  bubbleRef: ElementRef<HTMLDivElement>,
  {
    positionX = 'left',
    positionY = 'top',
    transformOriginX,
    transformOriginY,
    style,
    bubbleStyle,
  }: StaticPositionOptions,
) {
  const containerEl = containerRef.current!;
  const bubbleEl = bubbleRef.current!;

  if (style) {
    containerEl.style.cssText = style;
  }

  if (bubbleStyle) {
    bubbleEl.style.cssText = bubbleStyle;
  }

  if (positionX) {
    removeExtraClass(bubbleEl, positionX === 'left' ? 'right' : 'left');
    addExtraClass(bubbleEl, positionX);
  }

  if (positionY) {
    removeExtraClass(bubbleEl, positionY === 'top' ? 'bottom' : 'top');
    addExtraClass(bubbleEl, positionY);
  }

  setExtraStyles(bubbleEl, {
    transformOrigin: [
      transformOriginX ? `${transformOriginX}px` : positionX,
      transformOriginY ? `${transformOriginY}px` : positionY,
    ].join(' '),
  });
}

function processDynamically(
  containerRef: ElementRef<HTMLDivElement>,
  bubbleRef: ElementRef<HTMLDivElement>,
  {
    anchor,
    getRootElement,
    getMenuElement,
    getTriggerElement,
    getLayout,
    withMaxHeight,
  }: DynamicPositionOptions,
) {
  const triggerEl = getTriggerElement()!;

  let { x, y } = anchor;
  const anchorX = x;
  const anchorY = y;

  const menuEl = getMenuElement();
  const rootEl = getRootElement();

  const {
    extraPaddingX = 0,
    extraTopPadding = 0,
    topShiftY = 0,
    menuElMinWidth = 0,
    deltaX = 0,
    shouldAvoidNegativePosition = false,
    withPortal = false,
    isDense = false,
  } = getLayout?.() || {};

  const marginTop = menuEl ? parseInt(getComputedStyle(menuEl).marginTop, 10) : undefined;
  const { offsetWidth: menuElWidth, offsetHeight: menuElHeight } = menuEl || { offsetWidth: 0, offsetHeight: 0 };
  const menuRect = menuEl ? {
    width: Math.max(menuElWidth, menuElMinWidth),
    height: menuElHeight + marginTop!,
  } : EMPTY_RECT;

  const rootRect = rootEl ? rootEl.getBoundingClientRect() : EMPTY_RECT;

  let positionX: 'left' | 'right';
  let positionY: 'top' | 'bottom';
  if (isDense || (x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left)) {
    x += 3;
    positionX = 'left';
  } else if (x - menuRect.width - rootRect.left > 0) {
    positionX = 'right';
    x -= 3;
  } else {
    positionX = 'left';
    x = 16;
  }

  x += deltaX;

  const yWithTopShift = y + topShiftY;

  if (isDense || (yWithTopShift + menuRect.height < rootRect.height + rootRect.top)) {
    positionY = 'top';
    y = yWithTopShift;
  } else {
    positionY = 'bottom';

    if (y - menuRect.height < rootRect.top + extraTopPadding) {
      y = rootRect.top + rootRect.height;
    }
  }

  const triggerRect = triggerEl.getBoundingClientRect();

  const addedYForPortalPositioning = (withPortal ? triggerRect.top : 0);
  const addedXForPortalPositioning = (withPortal ? triggerRect.left : 0);

  const leftWithPossibleNegative = Math.min(
    x - triggerRect.left,
    rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
  );
  let left = (positionX === 'left'
    ? (withPortal || shouldAvoidNegativePosition
      ? Math.max(MENU_POSITION_VISUAL_COMFORT_SPACE_PX, leftWithPossibleNegative)
      : leftWithPossibleNegative)
    : (x - triggerRect.left)) + addedXForPortalPositioning;
  let top = y - triggerRect.top + addedYForPortalPositioning;

  if (isDense) {
    left = Math.min(left, rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX);
    top = Math.min(top, rootRect.height - menuRect.height - MENU_POSITION_VISUAL_COMFORT_SPACE_PX);
  }

  // Avoid hiding external parts of menus on mobile devices behind the edges of the screen (ReactionSelector for example)
  const addedXForMenuPositioning = menuElMinWidth ? Math.max(0, (menuElMinWidth - menuElWidth) / 2) : 0;
  if (left - addedXForMenuPositioning < 0 && shouldAvoidNegativePosition) {
    left = addedXForMenuPositioning + MENU_POSITION_VISUAL_COMFORT_SPACE_PX;
  }

  const offsetX = (anchorX + addedXForPortalPositioning - triggerRect.left) - left;
  const offsetY = (anchorY + addedYForPortalPositioning - triggerRect.top) - top - (marginTop || 0);
  const transformOriginX = positionX === 'left' ? offsetX : menuRect.width + offsetX;
  const transformOriginY = positionY === 'bottom' ? menuRect.height + offsetY : offsetY;

  const style = `left: ${left}px; top: ${top}px`;

  let bubbleStyle;
  if (withMaxHeight) {
    const menuMaxHeight = rootRect.height - MENU_POSITION_BOTTOM_MARGIN - (marginTop || 0);
    bubbleStyle = `max-height: ${menuMaxHeight}px;`;
  }

  return {
    positionX,
    positionY,
    transformOriginX,
    transformOriginY,
    style,
    bubbleStyle,
  };
}
