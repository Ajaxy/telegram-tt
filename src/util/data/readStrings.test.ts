import { describe, expect, test } from 'vitest';

import readStrings from './readStrings';

describe('readStrings', () => {
  test('keeps semicolons inside values', () => {
    expect(readStrings('"A" = "First; second";\r\n"B" = "Third";\n', true)).toEqual({
      A: 'First; second',
      B: 'Third',
    });
  });

  test('throws on missing semicolon in strict mode', () => {
    expect(() => readStrings('"A" = "First";\n"B" = "Second"\n', true)).toThrow('Missing semicolon in line 2');
  });

  test('skips bad lines in lenient mode', () => {
    expect(readStrings('"A" = "First"\n"B" = "Second";\n')).toEqual({ B: 'Second' });
  });
});
