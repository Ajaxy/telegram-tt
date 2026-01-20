import type { ApiSticker } from '../../../../api/types';

const SLOT_MAP = [1, 2, 3, 0];
export function prepareSlotMachine(stickers: ApiSticker[], value: number) {
  const isLocal = value === -1;

  const leftSlot = (value - 1) & 0b11;
  const middleSlot = ((value - 1) >> 2) & 0b11;
  const rightSlot = ((value - 1) >> 4) & 0b11;

  const bg = stickers[0];
  const frameWin = stickers[1];
  const frameStart = stickers[2];

  const leftWin = stickers[3];
  const leftResult = !isLocal ? stickers[4 + SLOT_MAP[leftSlot]] : undefined;
  const leftSpin = stickers[8];

  const middleWin = stickers[9];
  const middleResult = !isLocal ? stickers[10 + SLOT_MAP[middleSlot]] : undefined;
  const middleSpin = stickers[14];

  const rightWin = stickers[15];
  const rightResult = !isLocal ? stickers[16 + SLOT_MAP[rightSlot]] : undefined;
  const rightSpin = stickers[20];

  return {
    background: bg,
    frameWin,
    frameStart,
    leftWin,
    leftResult,
    leftSpin,
    middleWin,
    middleResult,
    middleSpin,
    rightWin,
    rightResult,
    rightSpin,
  };
}
