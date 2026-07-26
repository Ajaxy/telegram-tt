import type { Content, Editor } from '@tiptap/core';

export default function setEditorContentWithoutHistory(editor: Editor, content: Content) {
  editor.chain()
    .command(({ tr }) => {
      tr.setMeta('addToHistory', false);
      return true;
    })
    .setContent(content, { emitUpdate: false })
    .run();
}
