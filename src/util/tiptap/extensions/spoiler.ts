import { Mark } from '@tiptap/core';

import styles from '../styling.module.scss';

export const SpoilerMark = Mark.create({
  name: 'spoiler',

  parseHTML() {
    return [
      { tag: 'tg-spoiler' },
      { tag: 'span[data-rich-text-type="spoiler"]' },
    ];
  },

  renderHTML() {
    return ['span', {
      class: styles.spoiler,
      'data-rich-text-type': 'spoiler',
    }, 0];
  },
});
