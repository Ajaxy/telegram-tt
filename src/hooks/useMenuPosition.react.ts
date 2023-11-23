import { useEffect, useState } from 'react';

import type { IAnchorPosition } from '../types';

interface Layout {
  extraPaddingX?: number;
  extraTopPadding?: number;
  marginSides?: number;
  extraMarginTop?: number;
  menuElMinWidth?: number;
  deltaX?: number;
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
  anchor: IAnchorPosition | undefined,
  getTriggerElement: () => HTMLElement | null,
  getRootElement: () => HTMLElement | null,
  getMenuElement: () => HTMLElement | null,
  getLayout?: () => Layout,
) {
  const [positionX, setPositionX] = useState<'right' | 'left'>('right');
  const [positionY, setPositionY] = useState<'top' | 'bottom'>('bottom');
  const [transformOriginX, setTransformOriginX] = useState<number>();
  const [transformOriginY, setTransformOriginY] = useState<number>();
  const [withScroll, setWithScroll] = useState(false);
  const [style, setStyle] = useState({});
  const [menuStyle, setMenuStyle] = useState<{}>({ opacity: 0 });

  useEffect(() => {
    const triggerEl = getTriggerElement();
    if (!anchor || !triggerEl) {
      return;
    }

    let { x, y } = anchor;
    const anchorX = x;
    const anchorY = y;

    const menuEl = getMenuElement();
    const rootEl = getRootElement();

    const {
      extraPaddingX = 0,
      extraTopPadding = 0,
      marginSides = 0,
      extraMarginTop = 0,
      menuElMinWidth = 0,
      deltaX = 0,
      shouldAvoidNegativePosition = false,
      withPortal = false,
      isDense = false,
    } = getLayout?.() || {};

    const marginTop = menuEl ? parseInt(getComputedStyle(menuEl).marginTop, 10) + extraMarginTop : undefined;
    const { offsetWidth: menuElWidth, offsetHeight: menuElHeight } = menuEl || { offsetWidth: 0, offsetHeight: 0 };
    const menuRect = menuEl ? {
      width: Math.max(menuElWidth, menuElMinWidth),
      height: menuElHeight + marginTop!,
    } : EMPTY_RECT;

    const rootRect = rootEl ? rootEl.getBoundingClientRect() : EMPTY_RECT;

    let horizontalPosition: 'left' | 'right';
    let verticalPosition: 'top' | 'bottom';
    if (isDense || (x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left)) {
      x += 3;
      horizontalPosition = 'left';
    } else if (x - menuRect.width - rootRect.left > 0) {
      horizontalPosition = 'right';
      x -= 3;
    } else {
      horizontalPosition = 'left';
      x = 16;
    }
    setPositionX(horizontalPosition);

    if (marginSides
      && horizontalPosition === 'right' && (x + extraPaddingX + marginSides >= rootRect.width + rootRect.left)) {
      x -= marginSides;
    }

    if (marginSides && horizontalPosition === 'left') {
      if (x + extraPaddingX + marginSides + menuRect.width >= rootRect.width + rootRect.left) {
        x -= marginSides;
      } else if (x - marginSides <= 0) {
        x += marginSides;
      }
    }
    x += deltaX;

    if (isDense || (y + menuRect.height < rootRect.height + rootRect.top)) {
      verticalPosition = 'top';
    } else {
      verticalPosition = 'bottom';

      if (y - menuRect.height < rootRect.top + extraTopPadding) {
        y = rootRect.top + rootRect.height;
      }
    }
    setPositionY(verticalPosition);

    const triggerRect = triggerEl.getBoundingClientRect();

    const addedYForPortalPositioning = (withPortal ? triggerRect.top : 0);
    const addedXForPortalPositioning = (withPortal ? triggerRect.left : 0);

    const leftWithPossibleNegative = Math.min(
      x - triggerRect.left,
      rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX,
    );
    let left = (horizontalPosition === 'left'
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

    const menuMaxHeight = rootRect.height - MENU_POSITION_BOTTOM_MARGIN - (marginTop || 0);

    setWithScroll(menuMaxHeight < menuRect.height);
    setMenuStyle({ maxHeight: `${menuMaxHeight}px` });
    setStyle({ left: `${left}px`, top: `${top}px` });
    const offsetX = (anchorX + addedXForPortalPositioning - triggerRect.left) - left;
    const offsetY = (anchorY + addedYForPortalPositioning - triggerRect.top) - top - (marginTop || 0);
    setTransformOriginX(horizontalPosition === 'left' ? offsetX : menuRect.width + offsetX);
    setTransformOriginY(verticalPosition === 'bottom' ? menuRect.height + offsetY : offsetY);
  }, [
    anchor, getMenuElement, getRootElement, getTriggerElement, getLayout,
  ]);

  return {
    positionX,
    positionY,
    transformOriginX,
    transformOriginY,
    style,
    menuStyle,
    withScroll,
  };
}
