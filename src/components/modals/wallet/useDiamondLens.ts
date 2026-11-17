import { type ElementRef, useEffect, useRef } from '../../../lib/teact/teact';

import type StandaloneDiamond from '../../../lib/diamond/standalone';

import { drawLensText, MIN_LENS_STRENGTH } from '../../../lib/diamond/lensText';
import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectTheme } from '../../../global/selectors';
import { animate } from '../../../util/animation';
import { clamp } from '../../../util/math';
import { settle } from './helpers/motion';

import useSelector from '../../../hooks/data/useSelector';
import useLastCallback from '../../../hooks/useLastCallback';

type LensOptions = {
  blockRef: ElementRef<HTMLDivElement>;
  slotRef: ElementRef<HTMLElement>;
  gemFaceRef: ElementRef<HTMLElement>;
  // Shrinks to fit a long amount, and the diamond in it along with it
  fitRef?: ElementRef<HTMLElement>;
  // CSS pixels of the diamond frame at scale 1
  size: number;
  // The held diamond grows to `1 + growth` times its size
  growth: number;
};

type HoldState = {
  isHeld: boolean;
  isRunning: boolean;
  // A loop left from before a stop must not run along with the next one
  run: number;
  // Seconds
  changedAt: number;
  gripFrom: number;
};

// Seconds
const GROW_DURATION = 0.46;
const RELEASE_DURATION = 1.2;
// Released, the diamond swings below its size before it settles
const RELEASE_DECAY = 4.2;
const RELEASE_SWING = 7;
const HOLD_VIBRATION = 8;
const RELEASE_VIBRATION = 5;
// As in the iOS app, the amount reads deep blue through the stone on a light screen and white on a dark one
const INK = 'rgb(5, 33, 122)';
const DARK_THEME_INK = 'rgb(255, 255, 255)';
// Share of the diamond frame from its middle to just past its visible edge
const EDGE_REACH = 0.4;
// The block is inset by the screen padding, so the grown diamond stays about 1rem off the screen edge
const EDGE_MARGIN = 4;

export default function useDiamondLens(
  diamondRef: ElementRef<StandaloneDiamond>,
  {
    blockRef, slotRef, gemFaceRef, fitRef, size, growth,
  }: LensOptions,
  isEnabled: boolean,
  // Without the text, the held diamond only grows
  getTextElements?: () => HTMLElement[],
  // Runs as a DOM mutation when the diamond is picked up or put back
  onHoldChange?: NoneToVoidFunction,
) {
  const stateRef = useRef<HoldState>({
    isHeld: false, isRunning: false, run: 0, changedAt: 0, gripFrom: 0,
  });
  const textRef = useRef<HTMLCanvasElement>();
  const textVersionRef = useRef(0);
  const theme = useSelector(selectTheme);

  const hold = useLastCallback((isHeld: boolean) => {
    const state = stateRef.current;
    if (state.isHeld === isHeld || (isHeld && !isEnabled)) return;

    const now = getNow();
    state.gripFrom = getGrip(state, now);
    state.isHeld = isHeld;
    state.changedAt = now;
    navigator.vibrate?.(isHeld ? HOLD_VIBRATION : RELEASE_VIBRATION);

    if (onHoldChange) requestMutation(onHoldChange);

    if (state.isRunning) return;

    state.isRunning = true;

    const run = ++state.run;
    animate(() => tick(run), requestMeasure);
  });

  const tick = useLastCallback((run: number) => {
    const state = stateRef.current;
    if (!state.isRunning || run !== state.run) return false;

    const diamond = diamondRef.current;
    const now = getNow();

    if (!diamond || (!state.isHeld && now - state.changedAt >= RELEASE_DURATION)) {
      stop();

      return false;
    }

    const grip = getGrip(state, now);
    const scale = 1 + growth * grip;
    const strength = clamp(grip, 0, 1);
    const gemFace = gemFaceRef.current!;
    const fitElement = fitRef && fitRef.current!;
    const fitScale = fitElement ? fitElement.getBoundingClientRect().width / fitElement.offsetWidth : 1;
    const slotRect = slotRef.current!.getBoundingClientRect();
    const slotX = slotRect.left + slotRect.width / 2;
    const blockRect = blockRef.current!.getBoundingClientRect();
    const reach = EDGE_REACH * size * scale;
    // The grown diamond moves away from the screen edges, on either side of the digits, and its lens keeps the glyphs
    // in place
    const shift = Math.max(0, reach - (slotX - blockRect.left - EDGE_MARGIN) / fitScale)
      - Math.max(0, reach - (blockRect.right - EDGE_MARGIN - slotX) / fitScale);

    diamond.setScale(scale);

    diamond.lens = getTextElements && strength > MIN_LENS_STRENGTH ? {
      text: drawText(diamond, slotX, slotRect.top + slotRect.height / 2, fitScale),
      textVersion: textVersionRef.current,
      textShift: shift,
      strength,
    } : undefined;

    requestMutation(() => {
      gemFace.style.translate = shift ? `${shift}px 0` : '';
    });

    return true;
  });

  const stop = useLastCallback(() => {
    stateRef.current.isRunning = false;

    const diamond = diamondRef.current;

    if (diamond) {
      diamond.lens = undefined;
      diamond.setScale(1);
    }

    const gemFace = gemFaceRef.current;

    if (gemFace) {
      requestMutation(() => {
        gemFace.style.translate = '';
      });
    }
  });

  // In the coordinates of the diamond canvas as if it were not shifted
  const drawText = useLastCallback((diamond: StandaloneDiamond, centerX: number, centerY: number, fitScale: number) => {
    const canvas = textRef.current ?? (textRef.current = document.createElement('canvas'));
    const pixelSize = diamond.canvas.width;
    const { canvasSize } = diamond;
    const isChanged = drawLensText(canvas, pixelSize, getTextElements!(), {
      left: centerX - (canvasSize / 2) * fitScale,
      top: centerY - (canvasSize / 2) * fitScale,
      scale: pixelSize / (canvasSize * fitScale),
      ink: theme === 'dark' ? DARK_THEME_INK : INK,
    });
    if (isChanged) textVersionRef.current++;

    return canvas;
  });

  useEffect(() => {
    if (!isEnabled) return undefined;

    const state = stateRef.current;

    return () => {
      state.isHeld = false;
      if (state.isRunning) stop();
    };
  }, [isEnabled, stop]);

  return hold;
}

function getGrip({ isHeld, changedAt, gripFrom }: HoldState, now: number) {
  const time = now - changedAt;
  if (isHeld) return gripFrom + (1 - gripFrom) * settle(time / GROW_DURATION);

  return gripFrom * Math.exp(-RELEASE_DECAY * time) * Math.cos(RELEASE_SWING * time);
}

function getNow() {
  return performance.now() / 1000;
}
