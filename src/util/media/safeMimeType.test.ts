import { describe, expect, it } from 'vitest';

import { getSafeMimeType } from './safeMimeType';

describe('getSafeMimeType', () => {
  it('keeps media types', () => {
    ['video/mp4', 'audio/ogg', 'audio/ogg; codecs=opus', 'image/webp', 'video/webm'].forEach((type) => {
      expect(getSafeMimeType(type)).toBe(type);
    });
  });

  it('replaces scriptable and non-media types', () => {
    [
      'text/html', 'text/hthtmlml', 'image/svg+xml', 'IMAGE/SVG+XML', 'text/xml', 'application/xhtml+xml',
      'application/xhthtmlml+xml', 'application/pdf', 'application/x-tgsticker', 'video/mp4\ntext/html', '',
    ].forEach((type) => {
      expect(getSafeMimeType(type)).toBe('application/octet-stream');
    });
  });
});
