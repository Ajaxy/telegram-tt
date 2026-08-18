import { Node } from '@tiptap/core';

import { addLocalizationCallback, getTranslationFn } from '../../localization';
import { UNSUPPORTED_NODE_NAME } from '../constants';

import styles from '../styling.module.scss';

export const UnsupportedNode = Node.create({
  name: UNSUPPORTED_NODE_NAME,
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: `div[data-rich-text-type="${UNSUPPORTED_NODE_NAME}"]` }];
  },

  renderHTML() {
    return ['div', {
      class: styles.unsupported,
      contenteditable: 'false',
      'data-rich-text-type': UNSUPPORTED_NODE_NAME,
    }, getTranslationFn()('PageContentUnsupported')];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = styles.unsupported;
      dom.contentEditable = 'false';
      dom.dataset.richTextType = UNSUPPORTED_NODE_NAME;

      function updateLabel() {
        dom.textContent = getTranslationFn()('PageContentUnsupported');
      }

      updateLabel();
      return { dom, destroy: addLocalizationCallback(updateLabel) };
    };
  },
});
