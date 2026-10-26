import { type ElementRef, useRef } from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import useLastCallback from '../../../hooks/useLastCallback';

const THROW_SAMPLE_MS = 80;
// A shorter drag gives no speed to throw with
const THROW_MIN_SPAN_MS = 5;

export default function useDiamondThrow(diamondRef: ElementRef<StandaloneDiamond>) {
  const dragRef = useRef<{ x: number; y: number; samples: [number, number][] }>();

  const handlePointerDown = useLastCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || !diamondRef.current) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, samples: [[performance.now(), e.clientX]] };
    diamondRef.current.beginDrag();
  });

  const handlePointerMove = useLastCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    e.stopPropagation();
    // On macOS, Ctrl+click opens a context menu that takes the button release, so `pointerup` never arrives
    if (!e.buttons) {
      dragRef.current = undefined;
      diamondRef.current?.endDrag(0, true);
      return;
    }

    const now = performance.now();
    diamondRef.current?.drag(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.samples.push([now, e.clientX]);
    while (drag.samples.length > 2 && now - drag.samples[0][0] > THROW_SAMPLE_MS) drag.samples.shift();
  });

  const handlePointerUp = useLastCallback((e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    dragRef.current = undefined;
    const now = performance.now();
    const [firstTime, firstX] = drag.samples[0];
    const velocity = now - firstTime > THROW_MIN_SPAN_MS ? ((e.clientX - firstX) / (now - firstTime)) * 1000 : 0;
    diamondRef.current?.endDrag(velocity, e.type === 'pointercancel');
  });

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
