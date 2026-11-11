import type { ApiRichText } from '../../api/types';

export function hasRichText(text: ApiRichText): boolean {
  switch (text.type) {
    case 'empty':
      return false;
    case 'plain':
      return Boolean(text.text);
    case 'concat':
      return text.texts.some(hasRichText);
    case 'image':
    case 'math':
    case 'customEmoji':
      return true;
    default:
      return hasRichText(text.text);
  }
}
