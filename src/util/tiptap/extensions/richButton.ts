import { type Editor, Node as TiptapNode } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';

import { MAX_BUTTONS_PER_ROW } from '../../../global/helpers/buttons';
import {
  BUTTON_ROW_NODE_NAME, getButtonRowAlign, parseButtonHtmlAttrs, RICH_BUTTON_NODE_NAME,
} from '../richButton';

import styles from '../styling.module.scss';

export const RichButtonExtension = TiptapNode.create({
  name: RICH_BUTTON_NODE_NAME,
  group: 'inline',
  inline: true,
  content: '(text | emoji | customEmoji | formattedDate)*',
  marks: 'date',
  selectable: true,
  atom: true,
  isolating: true,
  addAttributes() {
    return {
      buttonType: { default: 'url' },
      url: { default: undefined },
      userId: { default: undefined },
      copyText: { default: undefined },
      color: { default: undefined },
    };
  },
  parseHTML() {
    return [{ tag: 'tg-button', getAttrs: parseButtonHtmlAttrs }];
  },
  renderHTML({ node }) {
    return ['span', { class: styles.richButton, 'data-color': node.attrs.color }, 0];
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { selection } = this.editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type !== this.type) return false;
        const element = this.editor.view.nodeDOM(selection.from);
        if (!(element instanceof HTMLElement)) return false;
        const button = element.querySelector('button');
        if (!button) return false;
        button.click();
        return true;
      },
      Backspace: () => deleteRichButton(this.editor, true),
      Delete: () => deleteRichButton(this.editor),
    };
  },
});

export const ButtonRowExtension = TiptapNode.create({
  name: BUTTON_ROW_NODE_NAME,
  group: 'block',
  content: `${RICH_BUTTON_NODE_NAME}{1,${MAX_BUTTONS_PER_ROW}}`,
  atom: true,
  isolating: true,
  addAttributes() {
    return { align: { default: undefined, parseHTML: (element) => getButtonRowAlign(element.getAttribute('align')) } };
  },
  parseHTML() {
    return [{ tag: 'tg-button-row' }];
  },
  renderHTML({ node }) {
    return ['div', { class: styles.buttonRow, 'data-align': node.attrs.align }, 0];
  },
});

function deleteRichButton(editor: Editor, isBackward?: boolean) {
  const { selection } = editor.state;
  const { $from, from } = selection;
  const node = selection instanceof NodeSelection ? selection.node
    : selection.empty ? (isBackward ? $from.nodeBefore : $from.nodeAfter) : undefined;
  if (node?.type.name !== RICH_BUTTON_NODE_NAME) return false;
  const position = selection instanceof NodeSelection || !isBackward ? from : from - node.nodeSize;
  return editor.commands.deleteRange({
    from: position,
    to: position + node.nodeSize,
  });
}
