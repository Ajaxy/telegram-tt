import type { ApiPeerColors } from '../api/types';

import { PEER_COLOR_BG_ACTIVE_OPACITY, PEER_COLOR_BG_OPACITY, PEER_COLOR_GRADIENT_STEP } from '../config';
import { fastRaf } from './schedulers';

const GENERAL_VARIABLES = new Map<string, string>();
const LIGHT_VARIABLES = new Map<string, string>();
const DARK_VARIABLES = new Map<string, string>();

const style = document.createElement('style');
document.head.appendChild(style);

export function setVariable(name: string, generalValue: string): void;
export function setVariable(name: string, lightValue: string, darkValue?: string): void;
export function setVariable(name: string, lightValueOrGeneral: string, darkValue?: string) {
  if (!darkValue) {
    GENERAL_VARIABLES.set(name, lightValueOrGeneral);
    LIGHT_VARIABLES.delete(name);
    DARK_VARIABLES.delete(name);
  } else {
    GENERAL_VARIABLES.delete(name);
    LIGHT_VARIABLES.set(name, lightValueOrGeneral);
    DARK_VARIABLES.set(name, darkValue);
  }

  scheduleVariableUpdate();
}

let isUpdateScheduled = false;
function scheduleVariableUpdate() {
  if (isUpdateScheduled) return;
  isUpdateScheduled = true;
  fastRaf(updateVariables);
}

function updateVariables() {
  const generalVariables = buildVariables(GENERAL_VARIABLES);
  const lightVariables = buildVariables(LIGHT_VARIABLES);
  const darkVariables = buildVariables(DARK_VARIABLES);

  style.textContent = `
    html {
      ${generalVariables}
    }

    html.theme-light {
      ${lightVariables}
    }

    html.theme-dark {
      ${darkVariables}
    }
  `;
}

function buildVariables(map: Map<string, string>) {
  return Array.from(map.entries()).map(([name, value]) => `--${name}: ${value};`).join(' ');
}

export function updatePeerColors(
  peerColors: ApiPeerColors['general'],
) {
  setPeerColor('0', ['#e17076']);
  setPeerColor('1', ['#faa774']);
  setPeerColor('2', ['#a695e7']);
  setPeerColor('3', ['#7bc862']);
  setPeerColor('4', ['#6ec9cb']);
  setPeerColor('5', ['#65aadd']);
  setPeerColor('6', ['#ee7aae']);

  Object.entries(peerColors).forEach(([key, value]) => {
    if (!value.colors) return;
    setPeerColor(key, value.colors, value.darkColors);
  });
}

function setPeerColor(n: string, colors: string[], darkColors?: string[]) {
  const mainLightColor = colors[0];
  const mainDarkColor = darkColors?.[0];
  if (!mainLightColor) return;

  const lightBgColor = `${mainLightColor}${PEER_COLOR_BG_OPACITY}`;
  const darkBgColor = mainDarkColor ? `${mainDarkColor}${PEER_COLOR_BG_OPACITY}` : undefined;

  const lightBgActiveColor = `${mainLightColor}${PEER_COLOR_BG_ACTIVE_OPACITY}`;
  const darkBgActiveColor = mainDarkColor ? `${mainDarkColor}${PEER_COLOR_BG_ACTIVE_OPACITY}` : undefined;

  setVariable(`color-peer-${n}`, mainLightColor, mainDarkColor);
  setVariable(`color-peer-bg-${n}`, lightBgColor, darkBgColor);
  setVariable(`color-peer-bg-active-${n}`, lightBgActiveColor, darkBgActiveColor);

  if (colors.length > 1) {
    const lightGradientColors = colors.map((color, i) => (
      `${color} ${i * PEER_COLOR_GRADIENT_STEP}px, ${color} ${(i + 1) * PEER_COLOR_GRADIENT_STEP}px`
    ));
    const darkGradientColors = darkColors?.map((color, i) => (
      `${color} ${i * PEER_COLOR_GRADIENT_STEP}px, ${color} ${(i + 1) * PEER_COLOR_GRADIENT_STEP}px`
    ));

    const lightGradient = `repeating-linear-gradient(-45deg, ${lightGradientColors.join(', ')})`;
    const darkGradient = darkGradientColors ? `repeating-linear-gradient(-45deg, ${darkGradientColors.join(', ')})`
      : undefined;
    setVariable(`color-peer-gradient-${n}`, lightGradient, darkGradient);
  }
}
