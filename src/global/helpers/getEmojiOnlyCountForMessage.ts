import type { ApiMessage } from '../../api/types';
import { ApiMessageEntityTypes } from '../../api/types';
import parseEmojiOnlyString from '../../util/parseEmojiOnlyString';

export function getEmojiOnlyCountForMessage(content: ApiMessage['content'], groupedId?: string): number | undefined {
  if (!content.text) return undefined;
  return (
    !groupedId
    && Object.keys(content).length === 1 // Only text is present
    && !content.text.entities?.some((entity) => entity.type !== ApiMessageEntityTypes.CustomEmoji)
    && parseEmojiOnlyString(content.text.text)
  ) || undefined;
}
