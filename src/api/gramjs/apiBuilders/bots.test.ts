import { describe, expect, test, vi } from 'vitest';

vi.mock('../../../lib/gramjs', () => {
  class BotInlineMessageMediaAuto {}
  class BotInlineMessageText {}
  class Photo {}
  class Document {}
  class ReplyKeyboardMarkup {}
  class ReplyInlineMarkup {}

  return {
    Api: {
      BotInlineMessageMediaAuto,
      BotInlineMessageText,
      Photo,
      Document,
      ReplyKeyboardMarkup,
      ReplyInlineMarkup,
    },
  };
});
vi.mock('../../../util/int2hex', () => ({ default: vi.fn() }));
vi.mock('../../../util/iteratees', () => ({ pick: vi.fn() }));
vi.mock('../../../util/numbers', () => ({ toJSNumber: vi.fn() }));
vi.mock('../helpers/localDb', () => ({ addDocumentToLocalDb: vi.fn() }));
vi.mock('./buttons', () => ({ buildApiInlineButtonAction: vi.fn(), buildApiReplyButtonAction: vi.fn() }));
vi.mock('./common', () => ({
  buildApiMessageEntity: (entity: { offset: number }) => ({ offset: entity.offset }),
  buildApiPhoto: () => ({ id: 'photo' }),
}));
vi.mock('./messageContent', () => ({
  buildApiDocument: () => ({ id: 'file' }),
  buildApiRichMessage: vi.fn(),
  buildApiWebDocument: vi.fn(),
  buildAudioFromDocument: () => ({ id: 'audio' }),
  buildGeoPoint: vi.fn(),
  buildVideoFromDocument: () => ({ id: 'video' }),
}));
vi.mock('./pathBytesToSvg', () => ({ buildSvgPath: vi.fn() }));
vi.mock('./peers', () => ({ buildApiPeerId: vi.fn() }));
vi.mock('./symbols', () => ({ buildStickerFromDocument: () => ({ id: 'sticker' }) }));

import { Api as GramJs } from '../../../lib/gramjs';
import { buildBotInlineMessage } from './bots';

function makeMessage(kind: 'media' | 'text', text: string, entities?: { offset: number }[]) {
  const prototype = kind === 'media'
    ? GramJs.BotInlineMessageMediaAuto.prototype
    : GramJs.BotInlineMessageText.prototype;
  return Object.assign(Object.create(prototype), { message: text, entities }) as Parameters<typeof buildBotInlineMessage>[0];
}

const document = Object.create(GramJs.Document.prototype) as Parameters<typeof buildBotInlineMessage>[2];
const photo = Object.create(GramJs.Photo.prototype) as Parameters<typeof buildBotInlineMessage>[3];

describe('buildBotInlineMessage', () => {
  test.each([
    ['photo', 'photo'],
    ['audio', 'audio'],
    ['video', 'video'],
    ['file', 'document'],
    ['gif', 'video'],
    ['sticker', 'sticker'],
  ])('preserves caption and entities for %s results', (type, mediaField) => {
    const result = buildBotInlineMessage(makeMessage('media', 'Caption', [{ offset: 2 }]), type, document, photo);

    expect(result.content).toMatchObject({
      [mediaField]: expect.any(Object),
      text: { text: 'Caption', entities: [{ offset: 2 }] },
    });
  });

  test('does not introduce an empty caption for captionless media', () => {
    const result = buildBotInlineMessage(makeMessage('media', ''), 'photo', undefined, photo);

    expect(result.content).toEqual({ photo: { id: 'photo' } });
  });

  test('keeps unsupported media text fallback', () => {
    const empty = buildBotInlineMessage(makeMessage('media', ''), 'unsupported');
    const captioned = buildBotInlineMessage(makeMessage('media', 'Fallback', [{ offset: 1 }]), 'unsupported');

    expect(empty.content).toEqual({ text: { text: '', entities: undefined } });
    expect(captioned.content).toEqual({ text: { text: 'Fallback', entities: [{ offset: 1 }] } });
  });

  test('keeps text-only results unchanged', () => {
    const result = buildBotInlineMessage(makeMessage('text', 'Message', [{ offset: 0 }]), 'article');

    expect(result.content).toEqual({ text: { text: 'Message', entities: [{ offset: 0 }] } });
  });
});
