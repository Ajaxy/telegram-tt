import { Extension, InputRule } from '@tiptap/core';
import { getGlobal } from '../../../../global';

import { selectSharedSettings } from '../../../../global/selectors/sharedState';

const TEXT_REPLACEMENTS = [
  { find: /--$/, replacement: '—' },
  { find: /<<$/, replacement: '«' },
  { find: />>$/, replacement: '»' },
  { find: /:shrug:$/, replacement: '¯\\_(ツ)_/¯' },
];

export const RichEditorTextReplacements = Extension.create({
  name: 'textReplacements',

  addInputRules() {
    return TEXT_REPLACEMENTS.map(({ find, replacement }) => new InputRule({
      find,
      handler: ({ state, range }) => {
        if (!selectSharedSettings(getGlobal()).shouldReplaceTextShortcuts) {
          return;
        }

        state.tr.insertText(replacement, range.from, range.to);
      },
    }));
  },
});
