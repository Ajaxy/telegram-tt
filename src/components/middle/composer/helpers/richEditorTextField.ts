import { mergeAttributes, Node as TiptapNode } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';

type RichEditorTextFieldParams = {
  name: string;
  dataAttribute: string;
};

export default function buildRichEditorTextField({
  name,
  dataAttribute,
}: RichEditorTextFieldParams) {
  return TiptapNode.create({
    name,
    content: 'inline*',

    addOptions() {
      return {
        HTMLAttributes: {},
      };
    },

    parseHTML() {
      return [{ tag: `div[${dataAttribute}]` }];
    },

    renderHTML({ HTMLAttributes }) {
      return [
        'div',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { [dataAttribute]: '' }),
        0,
      ];
    },

    addProseMirrorPlugins() {
      const nodeType = this.type;

      return [new Plugin({
        props: {
          handleClickOn: (view, _pos, node, nodePos, _event, direct) => {
            if (!direct || node.type !== nodeType || node.content.size) {
              return false;
            }

            view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, nodePos + 1)));
            view.focus();
            return true;
          },
        },
      })];
    },
  });
}
