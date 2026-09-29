import type { AiEditorContent } from '../types';

export function hasAiEditorContent(content: AiEditorContent) {
  return content.type === 'text' ? Boolean(content.text.text.trim()) : Boolean(content.richMessage.blocks.length);
}
