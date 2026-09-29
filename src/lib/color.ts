import { ColorSpace, HSL, HSV, P3, sRGB } from 'colorjs.io/fn';

[sRGB, HSL, HSV, P3].forEach((space) => ColorSpace.register(space));

export {
  getColor as buildColor,
  getLuminance,
  mix as mixColors,
  serialize as serializeColor,
  to as convertColor,
  toGamut as mapColorToGamut,
} from 'colorjs.io/fn';
export type { PlainColorObject as Color } from 'colorjs.io/fn';
