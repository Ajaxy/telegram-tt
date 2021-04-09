import { useState, useEffect } from '../lib/teact/teact';
import { IAnchorPosition } from '../types';

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
  const [style, setStyle] = useState('');

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

    if (x + menuRect.width + extraPaddingX < rootRect.width + rootRect.left) {
      setPositionX('left');
      x += 3;
    } else if (x - menuRect.width > 0) {
      setPositionX('right');
      x -= 3;
    } else {
      setPositionX('left');
      x = 16;
    }

    if (y + menuRect.height < rootRect.height + rootRect.top) {
      setPositionY('top');
    } else {
      setPositionY('bottom');

      if (y - menuRect.height < rootRect.top + extraTopPadding) {
        y = rootRect.top + extraTopPadding + menuRect.height;
      }
    }

    setStyle(`left: ${x - triggerRect.left}px; top: ${y - triggerRect.top}px;`);
  }, [
    anchor, extraPaddingX, extraTopPadding,
    getMenuElement, getRootElement, getTriggerElement,
  ]);

  return {
    positionX,
    positionY,
    style,
  };
};
