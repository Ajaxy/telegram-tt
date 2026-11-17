import type { ElementRef } from '../../../lib/teact/teact';
import { useEffect, useRef } from '../../../lib/teact/teact';

import type { Point, Size } from './helpers/cardStickers';
import type { CardStyle } from './helpers/cardStyleWave';
import type { StyleWaveSignal } from './useCardStyleWave';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { hasActiveThemeTransition, THEME_SWITCH_DURATION_MS } from '../../../util/switchTheme';
import { getPropertyHexColor } from '../../../util/themeStyle';
import { getStyleWaveCircle, STYLE_WAVE_EDGE } from './helpers/cardStyleWave';
import { shadeWalletCardColor, tintWalletCardColor } from './helpers/cardTint';

import { useSignalEffect } from '../../../hooks/useSignalEffect';

type Params = {
  buttonsRef: ElementRef<HTMLElement>;
  faceRef: ElementRef<HTMLElement>;
  style?: CardStyle;
  styleWave: StyleWaveSignal;
  // Repaints the buttons in a new theme
  themeKey?: string;
};

// The face size and the top left corners of the buttons against the face
type WaveLayout = {
  face: Size;
  buttons: Point[];
};

// The theme mixes its accent with black for the pressed buttons
const BUTTON_SHADE = 0.92;
const BUTTON_DARKER_SHADE = 0.84;
const BUTTON_COLOR_VARIABLES = ['--color-primary', '--color-primary-shade', '--color-primary-shade-darker'];

// As in the iOS app, the buttons under the card take the accent of the theme in its hue, and its color wave passes
// over them. The buttons take the new color at once, under an opaque wave that still shows the old one: the color of
// a button changes with a transition, which would show through if the wave left it to the end.
export default function useCardButtonsColor({
  buttonsRef, faceRef, style, styleWave, themeKey,
}: Params) {
  const primaryRef = useRef<string>();
  // Measured once per wave, as the buttons stay in place against the card while it runs
  const waveLayoutRef = useRef<WaveLayout>();

  useEffect(() => {
    let timeout: number | undefined;

    readPrimary();

    // The accent of a new theme is read once its transition ends
    function readPrimary() {
      requestMeasure(() => {
        const buttons = buttonsRef.current;
        if (!buttons) return;

        if (hasActiveThemeTransition(document.documentElement)) {
          timeout = window.setTimeout(readPrimary, THEME_SWITCH_DURATION_MS);
          return;
        }

        const primary = getThemePrimary(buttons);
        if (!primary) return;

        primaryRef.current = primary;
        requestMutation(() => paintButtonsBase(buttons, primary, style));
      });
    }

    return () => window.clearTimeout(timeout);
  }, [buttonsRef, style, themeKey]);

  // The first frame of a wave comes during a render, so the subscriber reads no layout and only schedules it
  useSignalEffect(() => {
    const wave = styleWave();
    const buttons = buttonsRef.current;
    const primary = primaryRef.current;
    if (!buttons || !primary) return;

    if (!wave) {
      waveLayoutRef.current = undefined;
      requestMutation(() => paintButtonsWave(buttons));
      return;
    }

    const layout = waveLayoutRef.current;
    if (!layout) {
      requestMeasure(() => {
        const face = faceRef.current;
        if (face) waveLayoutRef.current = measureWaveLayout(face, buttons);
      });
    }

    const waveColor = getButtonColor(primary, wave.isRemoving ? wave.from : wave.to);
    const baseColor = getButtonColor(primary, wave.isRemoving ? wave.to : wave.from);
    const images = Array.from(buttons.children, (_, i) => {
      if (wave.start === undefined || !layout) return `linear-gradient(${baseColor}, ${baseColor})`;

      const { origin, radius } = getStyleWaveCircle(wave, layout.face.width, layout.face.height);
      const corner = layout.buttons[i];

      return `radial-gradient(circle ${radius}px at ${origin.x - corner.x}px ${origin.y - corner.y}px, `
        + `${waveColor} ${Math.max(0, radius - STYLE_WAVE_EDGE)}px, ${baseColor} ${radius}px)`;
    });

    requestMutation(() => paintButtonsWave(buttons, images));
  }, [styleWave, buttonsRef, faceRef]);
}

function measureWaveLayout(face: HTMLElement, buttons: HTMLElement): WaveLayout {
  const faceRect = face.getBoundingClientRect();

  return {
    face: { width: faceRect.width, height: faceRect.height },
    buttons: Array.from(buttons.children, (button) => {
      const { left, top } = button.getBoundingClientRect();

      return { x: left - faceRect.left, y: top - faceRect.top };
    }),
  };
}

function paintButtonsBase(buttons: HTMLElement, primary: string, style?: CardStyle) {
  const color = getButtonColor(primary, style);
  const colors = [color, shadeWalletCardColor(color, BUTTON_SHADE), shadeWalletCardColor(color, BUTTON_DARKER_SHADE)];
  BUTTON_COLOR_VARIABLES.forEach((name, i) => {
    if (style) {
      buttons.style.setProperty(name, colors[i]);
    } else {
      buttons.style.removeProperty(name);
    }
  });
}

function paintButtonsWave(buttons: HTMLElement, images: string[] = []) {
  Array.from(buttons.children as HTMLCollectionOf<HTMLElement>).forEach((button, i) => {
    button.style.backgroundImage = images[i] ?? '';
  });
}

function getButtonColor(primary: string, style?: CardStyle) {
  return tintWalletCardColor(primary, style?.backdrop.centerColor, style?.backdrop.edgeColor);
}

// The accent the theme gives above the buttons, which the buttons override
function getThemePrimary(buttons: HTMLElement) {
  const parent = buttons.parentElement;

  return parent ? getPropertyHexColor(getComputedStyle(parent), '--color-primary') : undefined;
}
