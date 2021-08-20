import { Api as GramJs } from '../../../lib/gramjs';
import {
  ApiBotInlineMediaResult, ApiBotInlineResult, ApiBotInlineSwitchPm, ApiInlineResultType, ApiWebDocument,
} from '../../types';

import { pick } from '../../../util/iteratees';
import { buildApiPhoto, buildApiThumbnailFromStripped } from './common';
import { buildVideoFromDocument } from './messages';
import { buildStickerFromDocument } from './symbols';

export function buildApiBotInlineResult(result: GramJs.BotInlineResult, queryId: string): ApiBotInlineResult {
  const {
    id, type, title, description, url, thumb,
  } = result;

  return {
    id,
    queryId,
    type: type as ApiInlineResultType,
    title,
    description,
    url,
    webThumbnail: buildApiWebDocument(thumb),
  };
}

export function buildApiBotInlineMediaResult(
  result: GramJs.BotInlineMediaResult, queryId: string,
): ApiBotInlineMediaResult {
  const {
    id, type, title, description, photo, document,
  } = result;

  return {
    id,
    queryId,
    type: type as ApiInlineResultType,
    title,
    description,
    ...(type === 'sticker' && document instanceof GramJs.Document && { sticker: buildStickerFromDocument(document) }),
    ...(photo instanceof GramJs.Photo && { photo: buildApiPhoto(photo) }),
    ...(type === 'gif' && document instanceof GramJs.Document && { gif: buildVideoFromDocument(document) }),
    ...(type === 'video' && document instanceof GramJs.Document && {
      thumbnail: buildApiThumbnailFromStripped(document.thumbs),
    }),
  };
}

export function buildBotSwitchPm(switchPm?: GramJs.InlineBotSwitchPM) {
  return switchPm ? pick(switchPm, ['text', 'startParam']) as ApiBotInlineSwitchPm : undefined;
}

function buildApiWebDocument(document?: GramJs.TypeWebDocument): ApiWebDocument | undefined {
  return document ? pick(document, ['url', 'mimeType']) : undefined;
}
