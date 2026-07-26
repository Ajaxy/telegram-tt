import { Node } from '@tiptap/core';

import { UNSUPPORTED_NODE_NAME } from '../constants';

import styles from '../styling.module.scss';

export type UnsupportedNodeOptions = {
  label: string;
};

export const UnsupportedNode = Node.create<UnsupportedNodeOptions>({
  name: UNSUPPORTED_NODE_NAME,
  group: 'block',
  atom: true,

  addOptions() {
    return {
      label: '',
    };
  },

  parseHTML() {
    return [{ tag: `div[data-rich-text-type="${UNSUPPORTED_NODE_NAME}"]` }];
  },

  renderHTML() {
    return ['div', {
      class: styles.unsupported,
      contenteditable: 'false',
      'data-rich-text-type': UNSUPPORTED_NODE_NAME,
    }, this.options.label];
  },
});
