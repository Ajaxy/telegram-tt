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
  setPeerColor('0', ['#D45246']);
  setPeerColor('1', ['#F68136']);
  setPeerColor('2', ['#6C61DF']);
  setPeerColor('3', ['#46BA43']);
  setPeerColor('4', ['#5CAFFA']);
  setPeerColor('5', ['#408ACF']);
  setPeerColor('6', ['#D95574']);

  Object.entries(peerColors).forEach(([key, value]) => {
    if (!value.colors) return;
    setPeerColor(key, value.colors, value.darkColors);
  });
}

function setPeerColor(n: string, colors: string[], darkColors?: string[]) {
  const mainLightColor = colors[0];
  const mainDarkColor = darkColors?.[0];
  if (!mainLightColor) return;

  const { bg: lightBgColor, bgActive: lightBgActiveColor } = generateColorVariations(mainLightColor);
  const { bg: darkBgColor, bgActive: darkBgActiveColor } = mainDarkColor
    ? generateColorVariations(mainDarkColor) : { bg: undefined, bgActive: undefined };

  setVariable(`color-peer-${n}`, mainLightColor, mainDarkColor);
  setVariable(`color-peer-bg-${n}`, lightBgColor, darkBgColor);
  setVariable(`color-peer-bg-active-${n}`, lightBgActiveColor, darkBgActiveColor);

  if (colors.length > 1) {
    const lightGradient = generatePeerColorGradient(colors);
    const darkGradient = darkColors ? generatePeerColorGradient(darkColors) : undefined;
    setVariable(`color-peer-gradient-${n}`, lightGradient, darkGradient);
  }
}

export function generateColorVariations(baseColor: string) {
  return {
    bg: `${baseColor}${PEER_COLOR_BG_OPACITY}`,
    bgActive: `${baseColor}${PEER_COLOR_BG_ACTIVE_OPACITY}`,
  };
}

export function generatePeerColorGradient(colors: string[]) {
  if (colors.length === 1) return colors[0];

  const gradientColors = colors.map((color, i) => (
    `${color} ${i * PEER_COLOR_GRADIENT_STEP}px, ${color} ${(i + 1) * PEER_COLOR_GRADIENT_STEP}px`
  ));

  return `repeating-linear-gradient(-45deg, ${gradientColors.join(', ')})`;
}
