import { Mark } from '@tiptap/core';

import styles from '../styling.module.scss';

export const MarkedTextMark = Mark.create({
  name: 'marked',

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML() {
    return ['mark', {
      class: styles.markedText,
      'data-rich-text-type': 'marked',
    }, 0];
  },
});
