import { describe, expect, it } from 'vitest';

import type { ApiPageBlock, ApiRichText } from '../../api/types';

import { getRichQuoteTexts } from './richQuote';

const plain = (text: string): ApiRichText => ({ type: 'plain', text });

describe('getRichQuoteTexts', () => {
  it('collects quotable nodes in document order and skips non-quotable blocks', () => {
    const math: ApiPageBlock = { type: 'math', source: 'x^2' };
    const blocks: ApiPageBlock[] = [
      { type: 'header', text: plain('header') },
      {
        type: 'blockquoteBlocks',
        blocks: [{ type: 'paragraph', text: plain('nested') }],
        caption: plain('caption'),
      },
      { type: 'cover', cover: { type: 'paragraph', text: plain('cover') } },
      math,
      { type: 'paragraph', text: { type: 'empty' } },
      { type: 'details', title: plain('title'), blocks: [{ type: 'footer', text: plain('footer') }] },
    ];

    const texts = getRichQuoteTexts(blocks);

    expect(texts).toEqual([plain('nested'), plain('caption'), math, plain('title'), plain('footer')]);
    // Math blocks are matched to rendered elements by identity
    expect(texts[2]).toBe(math);
  });
});
