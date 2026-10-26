import type StandaloneDiamond from '../../../../lib/diamond/standalone';

import { createSignal } from '../../../../util/signals';

type SendFlight = {
  diamond: StandaloneDiamond;
  // Viewport CSS pixels of the diamond center when the flight starts
  x: number;
  y: number;
  startedAt: number;
};

export type SendFlightRow = {
  element: HTMLElement;
  land: (diamond: StandaloneDiamond) => void;
};

// The frame of the amount diamond leaves room around it, so it is larger than the 44px slot it stands in
export const AMOUNT_DIAMOND_SIZE = 56;
export const AMOUNT_DIAMOND_SPIN = (2 * Math.PI) / 26;
// 40dp as on Android
export const ROW_DIAMOND_SIZE = 40;
// The flying diamond and the one of the row keep one canvas, spin and sway
export const SEND_DIAMOND_CANVAS_SIZE = 150;
export const SEND_DIAMOND_SPIN = 6.5;
export const SEND_DIAMOND_SWAY = 1.6;

let launch: StandaloneDiamond | undefined;
let row: SendFlightRow | undefined;

export const [getSendFlight, setSendFlight] = createSignal<SendFlight | undefined>();

export function setSendLaunch(diamond?: StandaloneDiamond) {
  launch = diamond;
}

// The transfer is queued and the wallet goes back to the history: the diamond leaves the amount for the new row
export function startSendFlight() {
  if (!launch) return false;

  const diamond = launch;
  const rect = diamond.canvas.getBoundingClientRect();
  launch = undefined;
  diamond.isStoneHidden = true;
  setSendFlight({
    diamond, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, startedAt: performance.now(),
  });

  return true;
}

// The new row may appear before the flight starts, as both follow the same update
export function claimSendFlightRow(value: SendFlightRow) {
  if (row || (!launch && !getSendFlight())) return false;

  row = value;
  return true;
}

export function getSendFlightRow() {
  return row;
}

// The row stays pending after the landing, and the next transfer needs a row of its own
export function finishSendFlight() {
  setSendFlight(undefined);
  row = undefined;
}

export function releaseSendFlightRow(value: SendFlightRow) {
  if (row === value) row = undefined;
}
