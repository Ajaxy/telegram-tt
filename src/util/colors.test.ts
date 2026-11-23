import { describe, expect, test } from 'vitest';

import { buildColorFromHex, buildHexFromColor } from './colors';

describe('buildColorFromHex', () => {
  test.each([
    'hsl(0, 15%, 68.90196%)',
    'hsla(0, 15.000000000000002%, 68.90196078431372%, .4)',
    'rgb(176, 149, 149)',
    'rgba(176, 149, 149, .4)',
  ])('parses CSS functional color %s without treating it as a hex value', (input) => {
    const color = buildColorFromHex(input);

    expect(color.alpha).toBeCloseTo(input.startsWith('hsla') || input.startsWith('rgba') ? 0.4 : 1);
    expect(buildHexFromColor(color)).toMatch(/^#[0-9A-F]{6}$/i);
  });

  test('continues accepting hex values without a leading hash', () => {
    expect(buildHexFromColor(buildColorFromHex('b09595'))).toBe('#B09595');
  });
});
