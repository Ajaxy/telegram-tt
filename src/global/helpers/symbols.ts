import type { ApiFormattedText, ApiStickerSet } from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';

export function getStickerHashById(stickerId: string, isPreview?: boolean) {
  const base = `document${stickerId}`;
  return !isPreview ? base : `${base}?size=m`;
}

export function containsCustomEmoji(formattedText: ApiFormattedText) {
  return formattedText.entities?.some((e) => e.type === ApiMessageEntityTypes.CustomEmoji);
}

export function stripCustomEmoji(text: ApiFormattedText): ApiFormattedText {
  if (!text.entities) return text;

  const entities = text.entities.filter((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji);
  return { ...text, entities };
}

// The server can report an installation date of zero
export function getIsStickerSetInstalled(stickerSet: Pick<ApiStickerSet, 'installedDate'>) {
  return stickerSet.installedDate !== undefined;
}
