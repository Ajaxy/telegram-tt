import { useState, useEffect } from '../lib/teact/teact';
import { IAnchorPosition } from '../types';

const MENU_POSITION_VISUAL_COMFORT_SPACE_PX = 16;
const MENU_POSITION_BOTTOM_MARGIN = 12;

export default (
  anchor: IAnchorPosition | undefined,
  getTriggerElement: () => HTMLElement | null,
  getRootElement: () => HTMLElement | null,
  getMenuElement: () => HTMLElement | null,
  extraPaddingX = 0,
  extraTopPadding = 0,
) => {
  const [positionX, setPositionX] = useState<'right' | 'left'>('right');
  const [positionY, setPositionY] = useState<'top' | 'bottom'>('bottom');
  const [withScroll, setWithScroll] = useState(false);
  const [style, setStyle] = useState('');
  const [menuStyle, setMenuStyle] = useState('');

  useEffect(() => {
    const triggerEl = getTriggerElement();
    if (!anchor || !triggerEl) {
      return;
    }

    let { x, y } = anchor;
    const emptyRect = {
      width: 0, left: 0, height: 0, top: 0,
    };

    const menuEl = getMenuElement();
    const rootEl = getRootElement();

    const triggerRect = triggerEl.getBoundingClientRect();
    const menuRect = menuEl ? { width: menuEl.offsetWidth, height: menuEl.offsetHeight } : emptyRect;
    const rootRect = rootEl ? rootEl.getBoundingClientRect() : emptyRect;

    let horizontalPostition: 'left' | 'right';
    if (x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left) {
      x += 3;
      horizontalPostition = 'left';
    } else if (x - menuRect.width > 0) {
      horizontalPostition = 'right';
      x -= 3;
    } else {
      horizontalPostition = 'left';
      x = 16;
    }
    setPositionX(horizontalPostition);

    if (y + menuRect.height < rootRect.height + rootRect.top) {
      setPositionY('top');
    } else {
      setPositionY('bottom');

      if (y - menuRect.height < rootRect.top + extraTopPadding) {
        y = rootRect.top + rootRect.height;
      }
    }

    const left = horizontalPostition === 'left'
      ? Math.min(x - triggerRect.left, rootRect.width - menuRect.width - MENU_POSITION_VISUAL_COMFORT_SPACE_PX)
      : Math.max((x - triggerRect.left), menuRect.width + MENU_POSITION_VISUAL_COMFORT_SPACE_PX);
    const top = Math.min(
      rootRect.height - triggerRect.top + triggerRect.height - MENU_POSITION_BOTTOM_MARGIN,
      y - triggerRect.top,
    );
    const menuMaxHeight = rootRect.height - MENU_POSITION_BOTTOM_MARGIN;

    setWithScroll(menuMaxHeight < menuRect.height);
    setMenuStyle(`max-height: ${menuMaxHeight}px;`);
    setStyle(`left: ${left}px; top: ${top}px`);
  }, [
    anchor, extraPaddingX, extraTopPadding,
    getMenuElement, getRootElement, getTriggerElement,
  ]);

  return {
    positionX,
    positionY,
    style,
    menuStyle,
    withScroll,
  };
};
