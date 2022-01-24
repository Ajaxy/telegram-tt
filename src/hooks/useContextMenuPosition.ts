import { useState, useEffect } from '../lib/teact/teact';
import { IAnchorPosition } from '../types';

interface Layout {
  extraPaddingX?: number;
  extraTopPadding?: number;
  marginSides?: number;
  extraMarginTop?: number;
}

const MENU_POSITION_VISUAL_COMFORT_SPACE_PX = 16;
const MENU_POSITION_BOTTOM_MARGIN = 12;
const EMPTY_RECT = {
  width: 0, left: 0, height: 0, top: 0,
};

export default function useContextMenuPosition(
  anchor: IAnchorPosition | undefined,
  getTriggerElement: () => HTMLElement | null,
  getRootElement: () => HTMLElement | null,
  getMenuElement: () => HTMLElement | null,
  getLayout?: () => Layout,
) {
  const [positionX, setPositionX] = useState<'right' | 'left'>('right');
  const [positionY, setPositionY] = useState<'top' | 'bottom'>('bottom');
  const [withScroll, setWithScroll] = useState(false);
  const [style, setStyle] = useState('');
  const [menuStyle, setMenuStyle] = useState('opacity: 0;');

  useEffect(() => {
    const triggerEl = getTriggerElement();
    if (!anchor || !triggerEl) {
      return;
    }

    let { x, y } = anchor;

    const menuEl = getMenuElement();
    const rootEl = getRootElement();

    const {
      extraPaddingX = 0,
      extraTopPadding = 0,
      marginSides = 0,
      extraMarginTop = 0,
    } = getLayout?.() || {};

    const marginTop = menuEl ? parseInt(getComputedStyle(menuEl).marginTop, 10) + extraMarginTop : undefined;

    const menuRect = menuEl ? {
      width: menuEl.offsetWidth,
      height: menuEl.offsetHeight + marginTop!,
    } : EMPTY_RECT;

    const rootRect = rootEl ? rootEl.getBoundingClientRect() : EMPTY_RECT;

    let horizontalPosition: 'left' | 'right';
    if (x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left) {
      x += 3;
      horizontalPosition = 'left';
    } else if (x - menuRect.width > 0) {
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

    if (y + menuRect.height < rootRect.height + rootRect.top) {
      setPositionY('top');
    } else {
      setPositionY('bottom');

      if (y - menuRect.height < rootRect.top + extraTopPadding) {
        y = rootRect.top + rootRect.height;
      }
    }

    const triggerRect = triggerEl.getBoundingClientRect();
    const left = horizontalPosition === 'left'
      ? Math.min(x - triggerRect.left, rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX)
      : Math.max((x - triggerRect.left), menuRect.width + MENU_POSITION_VISUAL_COMFORT_SPACE_PX);
    const top = Math.min(
      rootRect.height - triggerRect.top + triggerRect.height - MENU_POSITION_BOTTOM_MARGIN + (marginTop || 0),
      y - triggerRect.top,
    );
    const menuMaxHeight = rootRect.height - MENU_POSITION_BOTTOM_MARGIN - (marginTop || 0);

    setWithScroll(menuMaxHeight < menuRect.height);
    setMenuStyle(`max-height: ${menuMaxHeight}px;`);
    setStyle(`left: ${left}px; top: ${top}px`);
  }, [
    anchor, getMenuElement, getRootElement, getTriggerElement, getLayout,
  ]);

  return {
    positionX,
    positionY,
    style,
    menuStyle,
    withScroll,
  };
}
