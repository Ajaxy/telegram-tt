import { describe, expect, it } from 'vitest';

import type { ApiRichMessage } from '../../api/types';

import { getRichMessageCustomEmojis } from './richMessage';

describe('getRichMessageCustomEmojis', () => {
  it('collects custom emoji from nested blocks and rich text', () => {
    const richMessage: ApiRichMessage = {
      blocks: [
        {
          type: 'paragraph',
          text: {
            type: 'concat',
            texts: [
              { type: 'plain', text: 'Hi ' },
              { type: 'bold', text: { type: 'customEmoji', documentId: '1', alt: '1' } },
            ],
          },
        },
        {
          type: 'list',
          items: [{
            type: 'blocks',
            blocks: [{ type: 'paragraph', text: { type: 'customEmoji', documentId: '2', alt: '2' } }],
          }],
        },
        { type: 'divider' },
      ],
    };

    expect(getRichMessageCustomEmojis(richMessage).map(({ documentId }) => documentId)).toEqual(['1', '2']);
  });
});
