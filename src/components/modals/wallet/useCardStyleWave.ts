import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef, useSignal } from '../../../lib/teact/teact';

import type { Signal } from '../../../util/signals';
import type { Point } from './helpers/cardStickers';
import type { CardStyle, StyleWave } from './helpers/cardStyleWave';

import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { animate } from '../../../util/animation';
import { getMotionTime } from './helpers/cardStickerMotion';
import {
  createStyleWave, getIsStyleWaveHeld, STYLE_APPLY_DURATION, STYLE_REMOVE_DURATION,
} from './helpers/cardStyleWave';

export type StyleWaveSignal = Signal<StyleWave | undefined>;

type Params = {
  style?: CardStyle;
  // Set while the card shows the user's unsaved decoration
  isEdited?: boolean;
  // The centers of the stickers on the card, in fractions
  origins: Record<string, Point>;
  heldAddresses?: string[];
  faceRef: ElementRef<HTMLDivElement>;
  buttonsRef: ElementRef<HTMLElement>;
  isEnabled?: boolean;
};

// Runs the wave of a color change and gives each frame to the card, its pattern and the buttons, which paint
// themselves. Subscribers get the first frame during a render, so they must not measure the DOM synchronously.
export default function useCardStyleWave({
  style, isEdited, origins, heldAddresses, faceRef, buttonsRef, isEnabled,
}: Params): StyleWaveSignal {
  const [getWave, setWave] = useSignal<StyleWave | undefined>();
  const isRunningRef = useRef(false);
  // A removed color recedes into the place its sticker had
  const originsRef = useRef<Record<string, Point>>({});
  const previousStyleRef = useRef<CardStyle | undefined>(style);
  const wasEditedRef = useRef(isEdited);

  originsRef.current = { ...originsRef.current, ...origins };

  // The wave starts in the render that brings the new color, so the color does not show before it. A change to or
  // from the user's decoration is the user's.
  const styleKey = getStyleKey(style);
  const styleKeyRef = useRef(styleKey);
  if (styleKeyRef.current !== styleKey) {
    const isUserChange = isEnabled && (isEdited || wasEditedRef.current);
    styleKeyRef.current = styleKey;
    // Only a change the user makes comes with a wave; a style the card gets on its own, as with a loaded profile,
    // shows at once
    setWave(isUserChange ? createStyleWave(previousStyleRef.current, style, originsRef.current) : undefined);
  }
  // Another gift with the same look keeps the key, yet a removed color must recede into its own sticker
  previousStyleRef.current = style;
  wasEditedRef.current = isEdited;

  const wave = getWave();
  if (wave && wave.start === undefined && !getIsStyleWaveHeld(wave, heldAddresses)) {
    setWave({ ...wave, start: getMotionTime() });
    run();
  }

  useEffect(() => () => {
    setWave(undefined);
  }, [setWave]);

  function run() {
    if (isRunningRef.current) return;

    isRunningRef.current = true;
    animate(tick, requestMeasure);
  }

  function tick() {
    const current = getWave();
    if (!current || current.start === undefined) {
      isRunningRef.current = false;
      return false;
    }

    const fraction = getStyleWaveFraction(current.start, current.isRemoving);
    if (fraction >= 1) {
      setWave(undefined);
      isRunningRef.current = false;
      return false;
    }

    setWave({ ...current, fraction, coverSize: current.coverSize ?? measureCoverSize() });

    return true;
  }

  // As in the iOS app, the circle reaches past the buttons too
  function measureCoverSize() {
    const faceRect = faceRef.current?.getBoundingClientRect();
    const buttonsRect = buttonsRef.current?.getBoundingClientRect();
    if (!faceRect) return undefined;

    return {
      width: Math.max(faceRect.right, buttonsRect?.right ?? 0) - faceRect.left,
      height: Math.max(faceRect.bottom, buttonsRect?.bottom ?? 0) - faceRect.top,
    };
  }

  return getWave;
}

function getStyleWaveFraction(start: number, isRemoving: boolean) {
  return (getMotionTime() - start) / (isRemoving ? STYLE_REMOVE_DURATION : STYLE_APPLY_DURATION);
}

function getStyleKey(style?: CardStyle) {
  if (!style) return '';

  const { backdrop, pattern } = style;

  return `${backdrop.centerColor}${backdrop.edgeColor}${backdrop.patternColor}${pattern?.sticker.id ?? ''}`;
}
