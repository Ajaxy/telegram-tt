import type { Editor } from '@tiptap/core';

import type { RichEditorTooltipsStorage } from './types';

export function hasActiveRichEditorTooltip(editor: Editor) {
  if (editor.isDestroyed) {
    return false;
  }

  const storage = (editor.storage as AnyLiteral).richEditorTooltips as RichEditorTooltipsStorage | undefined;
  return Boolean(storage?.controller?.hasActiveTooltip());
}
