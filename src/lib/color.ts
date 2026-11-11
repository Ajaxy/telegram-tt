import {
  ColorSpace, HSL, HSV, OKLab, OKLCH, P3, sRGB, sRGB_Linear,
} from 'colorjs.io/fn';

[sRGB, sRGB_Linear, HSL, HSV, P3, OKLab, OKLCH].forEach((space) => ColorSpace.register(space));

export {
  getColor as buildColor,
  getLuminance,
  mix as mixColors,
  serialize as serializeColor,
  to as convertColor,
  toGamut as mapColorToGamut,
} from 'colorjs.io/fn';
export type { PlainColorObject as Color } from 'colorjs.io/fn';
