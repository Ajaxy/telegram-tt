import { describe, expect, test } from 'vitest';

import { isSuspiciousUrl } from './url';

describe('Suspicious URL detection', () => {
  test.each([
    'https://example.com',
    'example.com',
    'my-site123.com',
    'bücher.de',
    'приклад.укр',
    'пример.com',
    'www.почта.рф',
    'օրինակ.հայ',
    '例え.jp',
    'ゲーム.jp',
    'カー.jp',
    '한국.com',
    'بيت.com',
    'עברית.com',
    'ᏣᎳᎩ.com',
    'аррӏе.com',
    'rnicrosoft.com',
    'paypa1.com',
    'https://example.com/@user',
    'http://192.168.0.1:67',
    'http://[::1]',
  ])('Allows %s', (url) => {
    expect(isSuspiciousUrl(url)).toBe(false);
  });

  test.each([
    'https://aррle.com',
    'пօчта.рф',
    'пοчта.рф',
    'abc日本.com',
    'aー.com',
    'https://почта.рф@evil.com',
    'https://example.com:443@evil.com',
    'https://xn--ale-0eda.com',
    'https://',
    'http://',
    ':::',
  ])('Flags %s', (url) => {
    expect(isSuspiciousUrl(url)).toBe(true);
  });

  test.each([
    'ひカ.jp',
    '漢한.com',
    '中文ㄅ.com',
  ])('Allows established CJK script combination %s', (url) => {
    expect(isSuspiciousUrl(url)).toBe(false);
  });
});
