import { describe, expect, it } from 'vitest';

import { validateHexColor } from './themeStyle';

describe('validateHexColor', () => {
  it('rejects non-strings that stringify to a valid hex', () => {
    expect(validateHexColor('#ffffff')).toBe(true);
    expect(validateHexColor(['#ffffff'])).toBe(false);
    expect(validateHexColor({ toString: () => '#ffffff' })).toBe(false);
  });
});
